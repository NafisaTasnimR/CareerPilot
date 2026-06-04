from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from app.db import supabase
import anthropic
import os

client = anthropic.Anthropic(api_key=os.getenv("GEMINI_API_KEY"))
scheduler = BackgroundScheduler()

def check_and_nudge():
    """Runs every hour. If user hasn't applied in 7 days, generate a nudge."""
    users = supabase.table("applications").select("user_id, created_at").execute().data

    # Group latest application per user
    latest = {}
    for row in users:
        uid = row["user_id"]
        if uid not in latest or row["created_at"] > latest[uid]:
            latest[uid] = row["created_at"]

    week_ago = (datetime.now() - timedelta(days=1)).isoformat()

    for uid, last_applied in latest.items():
        if last_applied < week_ago:
            # Check we haven't sent a nudge recently
            recent_nudge = supabase.table("nudges") \
                .select("id").eq("user_id", uid) \
                .gte("created_at", week_ago).execute().data
            
            if not recent_nudge:
                msg = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=150,
                    messages=[{
                        "role": "user",
                        "content": "Write a short, friendly, motivational nudge (2 sentences max) "
                                   "for a job seeker who hasn't applied to any jobs in a week. "
                                   "Be encouraging, not pushy."
                    }]
                ).content[0].text

                supabase.table("nudges").insert({
                    "user_id": uid,
                    "message": msg,
                    "seen": False
                }).execute()

def start_scheduler():
    scheduler.add_job(check_and_nudge, "interval", hours=1)
    scheduler.start()