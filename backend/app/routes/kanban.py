from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.db import supabase

router = APIRouter(prefix="/kanban", tags=["kanban"])

VALID_STATUSES = ["Applied", "Interviewing", "Offer", "Rejected"]

class ApplicationCreate(BaseModel):
    company: str
    role: str
    status: str = "Applied"
    notes: Optional[str] = None
    applied_date: Optional[date] = None

class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None

@router.get("/")
def get_applications(user_id: str):
    res = supabase.table("applications").select("*").eq("user_id", user_id).execute()
    return res.data

@router.post("/")
def create_application(app: ApplicationCreate, user_id: str):
    if app.status not in VALID_STATUSES:
        raise HTTPException(400, f"Status must be one of {VALID_STATUSES}")
    res = supabase.table("applications").insert({**app.dict(), "user_id": user_id}).execute()
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