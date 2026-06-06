from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.db import supabase
import google.generativeai as genai
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

router = APIRouter(prefix="/kanban", tags=["kanban"])

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.0-flash")

VALID_STATUSES = ["Applied", "Interviewing", "Offer", "Rejected"]

class ApplicationCreate(BaseModel):
    company: str
    role: str
    status: str = "Applied"
    notes: Optional[str] = None
    applied_date: Optional[str] = None
    redirect_url: Optional[str] = None
    fit_score: Optional[int] = None
    deadline: Optional[str] = None
    source: Optional[str] = "manual"

class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    applied_date: Optional[str] = None
    cover_letter: Optional[str] = None

class CoverLetterRequest(BaseModel):
    company: str
    role: str
    user_id: str
    notes: Optional[str] = None

class EmailRequest(BaseModel):
    app_id: str
    user_id: str
    user_name: str
    user_email: str
    user_password: str  # app password for Gmail
    hr_email: str
    cover_letter: str
    company: str
    role: str

@router.get("/")
def get_applications(user_id: str):
    res = supabase.table("applications").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return res.data

@router.post("/")
def create_application(app: ApplicationCreate, user_id: str):
    if app.status not in VALID_STATUSES:
        raise HTTPException(400, f"Status must be one of {VALID_STATUSES}")
    data = {k: v for k, v in app.dict().items() if v is not None}
    data["user_id"] = user_id
    res = supabase.table("applications").insert(data).execute()
    return res.data[0]

@router.patch("/{app_id}")
def update_application(app_id: str, update: ApplicationUpdate):
    data = {k: v for k, v in update.dict().items() if v is not None}
    if "status" in data and data["status"] not in VALID_STATUSES:
        raise HTTPException(400, "Invalid status")
    res = supabase.table("applications").update(data).eq("id", app_id).execute()
    return res.data[0]

@router.delete("/{app_id}")
def delete_application(app_id: str):
    supabase.table("applications").delete().eq("id", app_id).execute()
    return {"deleted": app_id}

@router.post("/cover-letter")
def generate_cover_letter(req: CoverLetterRequest):
    """Generate a personalized cover letter using CV context from Supabase."""
    # Try to get CV chunks for context
    cv_context = ""
    try:
        chunks = supabase.table("cv_chunks").select("content").eq("user_id", req.user_id).limit(10).execute()
        if chunks.data:
            cv_context = "\n".join([c["content"] for c in chunks.data])
    except:
        pass

    prompt = f"""Write a professional, personalized cover letter for this job application.

Company: {req.company}
Role: {req.role}
{f"Job notes: {req.notes}" if req.notes else ""}
{f"Candidate background: {cv_context[:1500]}" if cv_context else ""}

Write a compelling 3-paragraph cover letter that:
1. Opens with genuine enthusiasm for the specific role
2. Highlights 2-3 relevant skills/experiences
3. Closes with a clear call to action

Keep it under 300 words. Professional but not robotic. Do not use placeholder text like [Your Name]."""

    try:
        response = model.generate_content(prompt)
        cover_letter = response.text.strip()
    except Exception:
        cover_letter = f"""Dear Hiring Manager,

I am writing to express my strong interest in the {req.role} position at {req.company}. Having reviewed the requirements carefully, I am confident that my skills and experience make me an excellent candidate for this role.

Throughout my career, I have developed strong expertise in areas directly relevant to this position. I am particularly drawn to {req.company}'s work and believe I can contribute meaningfully to your team from day one.

I would welcome the opportunity to discuss how my background aligns with your needs. Thank you for considering my application.

Sincerely,
[Your Name]"""

    # Save cover letter to the application
    try:
        supabase.table("applications").update({"cover_letter": cover_letter}).eq("user_id", req.user_id).eq("company", req.company).eq("role", req.role).execute()
    except:
        pass

    return {"cover_letter": cover_letter}

@router.post("/send-email")
def send_application_email(req: EmailRequest):
    """Send application email to HR and mark as applied."""
    try:
        msg = MIMEMultipart()
        msg["From"] = req.user_email
        msg["To"] = req.hr_email
        msg["Subject"] = f"Application for {req.role} — {req.user_name}"

        body = f"""Dear Hiring Manager,

{req.cover_letter}

Best regards,
{req.user_name}
{req.user_email}"""

        msg.attach(MIMEText(body, "plain"))

        # Send via Gmail SMTP
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(req.user_email, req.user_password)
            server.send_message(msg)

        # Mark as Applied with today's date
        from datetime import date
        supabase.table("applications").update({
            "status": "Applied",
            "applied_date": str(date.today()),
            "cover_letter": req.cover_letter,
        }).eq("id", req.app_id).execute()

        return {"status": "sent", "message": f"Email sent to {req.hr_email}"}

    except smtplib.SMTPAuthenticationError:
        raise HTTPException(400, "Gmail authentication failed. Use an App Password, not your regular password. Enable it at myaccount.google.com/apppasswords")
    except Exception as e:
        raise HTTPException(500, f"Failed to send email: {str(e)}")