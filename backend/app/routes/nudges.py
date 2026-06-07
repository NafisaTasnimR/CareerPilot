from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import firebase_admin
from firebase_admin import auth as firebase_auth

from app.db import supabase
from app.models import User as UserModel
from app.services.gemini import generate_text

router = APIRouter(prefix="/nudges", tags=["nudges"])
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

@router.get("/")
def get_nudges(current_user = Depends(get_current_user), seen: bool = None):
    query = supabase.table("nudges").select("*").eq("user_id", current_user.firebase_uid)
    if seen is not None:
        query = query.eq("seen", seen)
    return query.order("created_at", desc=True).execute().data

@router.patch("/{nudge_id}/seen")
def mark_seen(nudge_id: str, current_user = Depends(get_current_user)):
    # Verify ownership
    res = supabase.table("nudges").select("*").eq("id", nudge_id).eq("user_id", current_user.firebase_uid).execute()
    if not res.data:
        raise HTTPException(403, "Nudge not found or unauthorized")
    res = supabase.table("nudges").update({"seen": True}).eq("id", nudge_id).execute()
    return res.data[0]

@router.delete("/{nudge_id}")
def delete_nudge(nudge_id: str, current_user = Depends(get_current_user)):
    # Verify ownership
    res = supabase.table("nudges").select("*").eq("id", nudge_id).eq("user_id", current_user.firebase_uid).execute()
    if not res.data:
        raise HTTPException(403, "Nudge not found or unauthorized")
    supabase.table("nudges").delete().eq("id", nudge_id).execute()
    return {"deleted": nudge_id}

@router.post("/generate")
def generate_nudge(current_user = Depends(get_current_user)):
    apps = supabase.table("applications").select("*").eq("user_id", current_user.firebase_uid).execute().data
    goals = supabase.table("goals").select("*").eq("user_id", current_user.firebase_uid).execute().data
    total_apps = len(apps)
    pending_goals = len([g for g in goals if not g["completed"]])

    try:
        prompt = f"Generate a short motivational career nudge for someone with {total_apps} applications and {pending_goals} pending goals. 2 sentences max."
        message = generate_text(prompt, model="gemini-2.0-flash")
    except Exception:
        # Fallback if quota exceeded
        if total_apps == 0:
            message = "You haven't applied to any jobs yet! Start with 3 applications today — consistency is the key to landing your dream role."
        elif pending_goals > 0:
            message = f"You have {pending_goals} pending goals waiting for you. Pick one and make progress on it today — small steps lead to big wins!"
        else:
            message = f"Great work! You've sent {total_apps} applications so far. Keep the momentum going and aim for 2 more this week."

    res = supabase.table("nudges").insert({
        "user_id": current_user.firebase_uid,
        "message": message,
        "seen": False
    }).execute()
    return res.data[0]