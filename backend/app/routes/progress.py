from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import firebase_admin
from firebase_admin import auth as firebase_auth

from app.db import supabase
from app.models import User as UserModel
from datetime import datetime, timedelta

router = APIRouter(prefix="/progress", tags=["progress"])
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

@router.get("/stats")
def get_stats(current_user = Depends(get_current_user)):
    apps = supabase.table("applications").select("*").eq("user_id", current_user["firebase_uid"]).execute().data
    tasks = supabase.table("tasks").select("*").eq("user_id", current_user["firebase_uid"]).execute().data
    goals = supabase.table("goals").select("*").eq("user_id", current_user["firebase_uid"]).execute().data

    # Weekly applications (last 7 days)
    week_ago = (datetime.now() - timedelta(days=7)).isoformat()
    weekly_apps = [a for a in apps if a["created_at"] >= week_ago]

    # Roadmap % = completed goals / total goals
    total_goals = len(goals)
    completed_goals = len([g for g in goals if g["completed"]])
    roadmap_pct = round((completed_goals / total_goals * 100) if total_goals else 0, 1)

    # Streak: consecutive days with activity (simplified)
    status_counts = {}
    for a in apps:
        s = a["status"]
        status_counts[s] = status_counts.get(s, 0) + 1

    return {
        "total_applications": len(apps),
        "weekly_applications": len(weekly_apps),
        "status_breakdown": status_counts,
        "tasks_completed": len([t for t in tasks if t["completed"]]),
        "tasks_total": len(tasks),
        "roadmap_percent": roadmap_pct,
        "goals_completed": completed_goals,
        "goals_total": total_goals,
    }