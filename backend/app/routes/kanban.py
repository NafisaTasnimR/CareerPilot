from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from datetime import date
from sqlalchemy.orm import Session
import firebase_admin
from firebase_admin import auth as firebase_auth

from app.db import supabase
from app.models import User as UserModel

router = APIRouter(prefix="/kanban", tags=["kanban"])
security = HTTPBearer()

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
def get_applications(current_user = Depends(get_current_user)):
    res = supabase.table("applications").select("*").eq("user_id", current_user.firebase_uid).execute()
    return res.data

@router.post("/")
def create_application(app: ApplicationCreate, current_user = Depends(get_current_user)):
    if app.status not in VALID_STATUSES:
        raise HTTPException(400, f"Status must be one of {VALID_STATUSES}")
    res = supabase.table("applications").insert({**app.dict(), "user_id": current_user.firebase_uid}).execute()
    return res.data[0]

@router.patch("/{app_id}")
def update_application(app_id: str, update: ApplicationUpdate, current_user = Depends(get_current_user)):
    # Verify that the application belongs to the current user
    res = supabase.table("applications").select("*").eq("id", app_id).eq("user_id", current_user.firebase_uid).execute()
    if not res.data:
        raise HTTPException(403, "Application not found or unauthorized")
    
    data = {k: v for k, v in update.dict().items() if v is not None}
    if "status" in data and data["status"] not in VALID_STATUSES:
        raise HTTPException(400, "Invalid status")
    res = supabase.table("applications").update(data).eq("id", app_id).execute()
    return res.data[0]

@router.delete("/{app_id}")
def delete_application(app_id: str, current_user = Depends(get_current_user)):
    # Verify that the application belongs to the current user
    res = supabase.table("applications").select("*").eq("id", app_id).eq("user_id", current_user.firebase_uid).execute()
    if not res.data:
        raise HTTPException(403, "Application not found or unauthorized")
    
    supabase.table("applications").delete().eq("id", app_id).execute()
    return {"deleted": app_id}