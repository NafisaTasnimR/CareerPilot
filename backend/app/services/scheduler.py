"""
scheduler.py  (replaces your existing scheduler.py)

Runs every 2 hours.
For every user in the system, calls the nudge engine which:
  - checks cooldown
  - builds rich context from DB + CV
  - detects the highest-priority event
  - generates a personalized message via Gemini
  - stores it in the nudges table

The scheduler itself is thin — all intelligence lives in nudge_engine.py.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.db import supabase
from app.services.nudge_engine import generate_and_store_nudge

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def run_nudge_cycle() -> None:
    """
    Entry point called by APScheduler every 2 hours.
    Fetches all known user IDs and runs the nudge engine for each.
    """
    logger.info("Nudge cycle started.")

    try:
        users = (
            supabase.table("users")
            .select("id")
            .execute()
            .data or []
        )
    except Exception as exc:
        logger.error("Failed to fetch users: %s", exc)
        return

    if not users:
        logger.info("No users found. Nudge cycle done.")
        return

    success, skipped, failed = 0, 0, 0

    for user in users:
        uid = user.get("id")
        if not uid:
            continue
        try:
            result = generate_and_store_nudge(uid)
            if result:
                success += 1
            else:
                skipped += 1
        except Exception as exc:
            logger.error("Nudge engine error for user %s: %s", uid, exc)
            failed += 1

    logger.info(
        "Nudge cycle complete. sent=%d  skipped=%d  failed=%d",
        success, skipped, failed,
    )


def start_scheduler() -> None:
    """Start APScheduler safely (idempotent)."""
    if scheduler.running:
        logger.info("Scheduler already running.")
        return

    scheduler.add_job(
        run_nudge_cycle,
        trigger="interval",
        hours=2,
        id="career_nudge_job",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.start()
    logger.info("Nudge scheduler started (interval: 2h).")


def stop_scheduler() -> None:
    """Gracefully shut down."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")