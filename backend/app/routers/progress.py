from fastapi import APIRouter
from app.db import supabase
from datetime import datetime, timedelta

router = APIRouter(prefix="/progress", tags=["progress"])

@router.get("/stats")
def get_stats(user_id: str):
    apps = supabase.table("applications").select("*").eq("user_id", user_id).execute().data
    tasks = supabase.table("tasks").select("*").eq("user_id", user_id).execute().data
    goals = supabase.table("goals").select("*").eq("user_id", user_id).execute().data

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