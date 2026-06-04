from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from app.db import supabase
import anthropic
import os
import logging

client = anthropic.Anthropic(api_key=os.getenv("GEMINI_API_KEY"))
scheduler = BackgroundScheduler()

def check_and_nudge():
    """Runs every hour. If user hasn't applied in 7 days, generate a nudge."""
    try:
        # 1. Calculate the cutoff date
        week_ago = (datetime.now() - timedelta(days=7)).isoformat()
        
        # 2. Fetch only users who haven't applied since week_ago
        # We use a subquery-like approach: find users who HAVE applied recently, 
        # then we'd normally exclude them. Since Supabase Python client is limited,
        # we fetch users with their latest application date.
        
        # Optimization: Fetch only the necessary columns and filter by date if possible
        # Note: In a real production app, this would be a stored procedure or a complex view
        apps_data = supabase.table("applications") \
            .select("user_id, created_at") \
            .execute().data
        
        if not apps_data:
            logger.debug("No applications found")
            return

        # Group latest application per user in memory (still O(N) but better than N queries)
        latest = {}
        for row in apps_data:
            uid = row["user_id"]
            if uid not in latest or row["created_at"] > latest[uid]:
                latest[uid] = row["created_at"]

    week_ago = (datetime.now() - timedelta(days=1)).isoformat()

        # 4. Batch check for recent nudges to avoid N+1 queries
        # Fetch all nudges created after week_ago for these specific users
        recent_nudges_data = supabase.table("nudges") \
            .select("user_id") \
            .gte("created_at", week_ago) \
            .in_("user_id", due_for_nudge) \
            .execute().data
        
        nudged_users = {row["user_id"] for row in recent_nudges_data}

        for uid in due_for_nudge:
            if uid in nudged_users:
                continue
                
            try:
                # Add timeout to prevent hanging
                msg = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=150,
                    messages=[{
                        "role": "user",
                        "content": "Write a short, friendly, motivational nudge (2 sentences max) "
                                   "for a job seeker who hasn't applied to any jobs in a week. "
                                   "Be encouraging, not pushy."
                    }],
                    timeout=30
                ).content[0].text

                supabase.table("nudges").insert({
                    "user_id": uid,
                    "message": msg,
                    "seen": False
                }).execute()
            except Exception as e:
                logger.error(f"Error processing nudge for user {uid}: {str(e)}")
                continue
                
    except Exception as e:
        logger.error(f"Error in check_and_nudge scheduler: {str(e)}")

def start_scheduler():
    try:
        scheduler.add_job(check_and_nudge, "interval", hours=1, max_instances=1)
        scheduler.start()
        logger.info("Scheduler started successfully")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {str(e)}")