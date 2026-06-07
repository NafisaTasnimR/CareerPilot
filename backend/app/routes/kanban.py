import os
import random
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from google import genai

import firebase_admin
from firebase_admin import auth as firebase_auth

from app.db import supabase

router = APIRouter(prefix="/kanban", tags=["kanban"])
security = HTTPBearer()

_genai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

VALID_STATUSES = ["Applied", "Interviewing", "Offer", "Rejected"]


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    try:
        decoded_token = firebase_auth.verify_id_token(token, clock_skew_seconds=60)
        uid = decoded_token['uid']

        result = supabase.table("users").select("*").eq("firebase_uid", uid).single().execute()
        if not result.data:
            raise HTTPException(status_code=401, detail="User not found")
        return result.data
    except firebase_admin.exceptions.FirebaseError as e:
        raise HTTPException(status_code=401, detail=f"Firebase error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")


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
    user_password: str
    hr_email: str
    cover_letter: str
    company: str
    role: str


@router.get("/")
def get_applications(current_user=Depends(get_current_user)):
    res = supabase.table("applications").select("*").eq("user_id", current_user["firebase_uid"]).execute()
    return res.data


@router.post("/")
def create_application(app: ApplicationCreate, current_user=Depends(get_current_user)):
    if app.status not in VALID_STATUSES:
        raise HTTPException(400, f"Status must be one of {VALID_STATUSES}")
    res = supabase.table("applications").insert({**app.dict(), "user_id": current_user["firebase_uid"]}).execute()
    return res.data[0]


@router.patch("/{app_id}")
def update_application(app_id: str, update: ApplicationUpdate, current_user=Depends(get_current_user)):
    res = supabase.table("applications").select("*").eq("id", app_id).eq("user_id", current_user["firebase_uid"]).execute()
    if not res.data:
        raise HTTPException(403, "Application not found or unauthorized")

    data = {k: v for k, v in update.dict().items() if v is not None}
    if "status" in data and data["status"] not in VALID_STATUSES:
        raise HTTPException(400, "Invalid status")
    res = supabase.table("applications").update(data).eq("id", app_id).execute()
    return res.data[0]


@router.delete("/{app_id}")
def delete_application(app_id: str, current_user=Depends(get_current_user)):
    res = supabase.table("applications").select("*").eq("id", app_id).eq("user_id", current_user["firebase_uid"]).execute()
    if not res.data:
        raise HTTPException(403, "Application not found or unauthorized")

    supabase.table("applications").delete().eq("id", app_id).execute()
    return {"deleted": app_id}


@router.post("/cover-letter")
def generate_cover_letter(req: CoverLetterRequest):
    cv_context = ""
    try:
        chunks = supabase.table("cv_chunks").select("content").eq("user_id", req.user_id).limit(10).execute()
        if chunks.data:
            cv_context = "\n".join([c["content"] for c in chunks.data])
    except Exception:
        pass

    styles = [
        "confident and direct, leading with your biggest achievement",
        "storytelling style, opening with a specific problem you solved",
        "data-driven, emphasizing measurable results and impact",
        "enthusiastic and forward-looking, focusing on future contributions",
        "concise and punchy, every sentence earning its place",
    ]
    style = random.choice(styles)

    prompt = f"""Write a professional cover letter for this job. Style: {style}.

Company: {req.company}
Role: {req.role}
{f"Notes: {req.notes}" if req.notes else ""}
{f"Candidate background: {cv_context[:1500]}" if cv_context else ""}

Rules:
- 3 paragraphs, under 280 words
- Style must be: {style}
- No placeholder text like [Your Name]
- Do NOT repeat the previous version — this must be meaningfully different"""

    try:
        response = _genai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        cover_letter = (getattr(response, "text", "") or "").strip()
    except Exception as e:
        cover_letter = f"Failed to generate: {str(e)}"

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

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(req.user_email, req.user_password)
            server.send_message(msg)

        supabase.table("applications").update({
            "status": "Applied",
            "applied_date": str(date.today()),
            "cover_letter": req.cover_letter,
        }).eq("id", req.app_id).execute()

        return {"status": "sent", "message": f"Email sent to {req.hr_email}"}

    except smtplib.SMTPAuthenticationError:
        raise HTTPException(
            400,
            "Gmail authentication failed. Use an App Password, not your regular password. "
            "Enable it at myaccount.google.com/apppasswords",
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to send email: {str(e)}")