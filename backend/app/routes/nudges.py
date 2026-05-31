from fastapi import APIRouter
from app.db import supabase
import google.generativeai as genai
import os

router = APIRouter(prefix="/nudges", tags=["nudges"])

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.0-flash")

@router.get("/")
def get_nudges(user_id: str, seen: bool = None):
    query = supabase.table("nudges").select("*").eq("user_id", user_id)
    if seen is not None:
        query = query.eq("seen", seen)
    return query.order("created_at", desc=True).execute().data

@router.patch("/{nudge_id}/seen")
def mark_seen(nudge_id: str):
    res = supabase.table("nudges").update({"seen": True}).eq("id", nudge_id).execute()
    return res.data[0]

@router.delete("/{nudge_id}")
def delete_nudge(nudge_id: str):
    supabase.table("nudges").delete().eq("id", nudge_id).execute()
    return {"deleted": nudge_id}

@router.post("/generate")
def generate_nudge(user_id: str):
    apps = supabase.table("applications").select("*").eq("user_id", user_id).execute().data
    goals = supabase.table("goals").select("*").eq("user_id", user_id).execute().data
    total_apps = len(apps)
    pending_goals = len([g for g in goals if not g["completed"]])

    try:
        prompt = f"Generate a short motivational career nudge for someone with {total_apps} applications and {pending_goals} pending goals. 2 sentences max."
        response = model.generate_content(prompt)
        message = response.text.strip()
    except Exception:
        # Fallback if quota exceeded
        if total_apps == 0:
            message = "You haven't applied to any jobs yet! Start with 3 applications today — consistency is the key to landing your dream role."
        elif pending_goals > 0:
            message = f"You have {pending_goals} pending goals waiting for you. Pick one and make progress on it today — small steps lead to big wins!"
        else:
            message = f"Great work! You've sent {total_apps} applications so far. Keep the momentum going and aim for 2 more this week."

    res = supabase.table("nudges").insert({
        "user_id": user_id,
        "message": message,
        "seen": False
    }).execute()
    return res.data[0]