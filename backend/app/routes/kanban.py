import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from groq import Groq

import firebase_admin
from firebase_admin import auth as firebase_auth

from app.db import supabase

router = APIRouter(prefix="/kanban", tags=["kanban"])
security = HTTPBearer()

_groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

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

    prompt = f"""Write a formal, concise job application cover letter.

Company: {req.company}
Role: {req.role}
{f"Additional context: {req.notes}" if req.notes else ""}
{f"Candidate background: {cv_context[:1500]}" if cv_context else ""}

Requirements:
- Start with "Dear Hiring Manager,"
- Paragraph 1: Express genuine interest in this specific role and company in one or two sentences
- Paragraph 2: Highlight the most relevant skills and experience from the candidate background that directly match this role
- Paragraph 3: One sentence closing expressing availability for an interview
- End with "Sincerely," on its own line, then leave the signature line blank
- Under 250 words total
- Formal professional tone — no storytelling, no dramatised past incidents, no generic phrases
- Be specific and direct. Every sentence must serve a purpose.
- Do NOT invent experience that is not in the candidate background
- Do NOT add any name after Sincerely"""

    try:
        response = _groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600,
            temperature=0.5,
        )
        cover_letter = response.choices[0].message.content.strip()
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