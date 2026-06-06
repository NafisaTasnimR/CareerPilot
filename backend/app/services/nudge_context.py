"""
nudge_context.py

Assembles a rich, structured context object for a given user by pulling from:
  - applications table  (weekly cadence, last activity, status distribution)
  - goals table         (pending / overdue / completion rate)
  - tasks table         (overdue tasks, tasks due soon)
  - cv_embeddings table (skills, experience — via RAG query)

Nothing in here calls Gemini.  This is pure data assembly.
The context dict is the single input to the nudge event detector.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from app.db import supabase

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# helpers
# ──────────────────────────────────────────────

def _today() -> date:
    return datetime.now(timezone.utc).date()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _days_ago(n: int) -> str:
    """ISO string for n days ago (UTC)."""
    return (_utcnow() - timedelta(days=n)).isoformat()


# ──────────────────────────────────────────────
# sub-fetchers
# ──────────────────────────────────────────────

def _fetch_application_stats(user_id: str) -> dict:
    """
    Returns:
        total_applications      – all time
        applications_this_week  – created in last 7 days
        days_since_last_applied – int, None if never applied
        status_counts           – {"Applied": n, "Interviewing": n, ...}
        applied_companies       – list[str] of recent company names
    """
    rows = (
        supabase.table("applications")
        .select("id, status, company, role, applied_date, created_at")
        .eq("user_id", user_id)
        .execute()
        .data or []
    )

    total = len(rows)
    week_cutoff = _days_ago(7)
    this_week = [r for r in rows if (r.get("created_at") or "") >= week_cutoff]

    # last applied
    dates = [r["applied_date"] for r in rows if r.get("applied_date")]
    if dates:
        latest_date = max(dates)
        days_since = (_today() - date.fromisoformat(latest_date)).days
    else:
        days_since = None

    status_counts: dict[str, int] = {}
    for r in rows:
        s = r.get("status") or "Applied"
        status_counts[s] = status_counts.get(s, 0) + 1

    # last 5 companies applied to
    sorted_rows = sorted(rows, key=lambda r: r.get("created_at") or "", reverse=True)
    recent_companies = [r["company"] for r in sorted_rows[:5] if r.get("company")]

    return {
        "total_applications": total,
        "applications_this_week": len(this_week),
        "days_since_last_applied": days_since,
        "status_counts": status_counts,
        "recent_companies": recent_companies,
    }


def _fetch_goal_stats(user_id: str) -> dict:
    """
    Returns:
        total_goals         – int
        completed_goals     – int
        pending_goals       – int
        overdue_goals       – int  (deadline passed, not completed)
        due_soon_goals      – list[str] titles due in next 3 days
        completion_rate_pct – 0-100
    """
    rows = (
        supabase.table("goals")
        .select("id, title, deadline, completed")
        .eq("user_id", user_id)
        .execute()
        .data or []
    )

    today = _today()
    completed = [r for r in rows if r.get("completed")]
    pending   = [r for r in rows if not r.get("completed")]

    overdue = [
        r for r in pending
        if r.get("deadline") and date.fromisoformat(r["deadline"]) < today
    ]

    due_soon = [
        r["title"] for r in pending
        if r.get("deadline")
        and today <= date.fromisoformat(r["deadline"]) <= today + timedelta(days=3)
    ]

    total = len(rows)
    rate  = round(len(completed) / total * 100) if total else 0

    return {
        "total_goals": total,
        "completed_goals": len(completed),
        "pending_goals": len(pending),
        "overdue_goals": len(overdue),
        "due_soon_goals": due_soon,
        "completion_rate_pct": rate,
    }


def _fetch_task_stats(user_id: str) -> dict:
    """
    Returns:
        total_tasks         – int
        completed_tasks     – int
        overdue_tasks       – int
        due_today_tasks     – list[str] titles due today
        due_soon_tasks      – list[str] titles due in next 2 days
    """
    rows = (
        supabase.table("tasks")
        .select("id, title, due_date, completed")
        .eq("user_id", user_id)
        .execute()
        .data or []
    )

    today = _today()
    completed = [r for r in rows if r.get("completed")]
    pending   = [r for r in rows if not r.get("completed")]

    overdue = [
        r for r in pending
        if r.get("due_date") and date.fromisoformat(r["due_date"]) < today
    ]

    due_today = [
        r["title"] for r in pending
        if r.get("due_date") and date.fromisoformat(r["due_date"]) == today
    ]

    due_soon = [
        r["title"] for r in pending
        if r.get("due_date")
        and today < date.fromisoformat(r["due_date"]) <= today + timedelta(days=2)
    ]

    return {
        "total_tasks": len(rows),
        "completed_tasks": len(completed),
        "overdue_tasks": len(overdue),
        "due_today_tasks": due_today,
        "due_soon_tasks": due_soon,
    }


def _fetch_cv_highlights(user_id: str) -> dict:
    """
    Pulls the skills and experience chunks from cv_embeddings.
    We do a direct text fetch (no vector query needed here — we just
    want representative content for the nudge prompt).

    Returns:
        skills_text      – str  (raw skills chunk text)
        experience_text  – str  (raw experience chunk text)
        has_cv           – bool
    """
    try:
        rows = (
            supabase.table("cv_embeddings")
            .select("section, content")
            .eq("source", user_id)          # source = file_id = user_id in your pipeline
            .in_("section", ["skills", "experience", "summary"])
            .limit(12)
            .execute()
            .data or []
        )
    except Exception as exc:
        logger.warning("cv_embeddings fetch failed for %s: %s", user_id, exc)
        rows = []

    if not rows:
        return {"skills_text": "", "experience_text": "", "has_cv": False}

    skills_chunks = [r["content"] for r in rows if r.get("section") == "skills"]
    exp_chunks    = [r["content"] for r in rows if r.get("section") == "experience"]
    summary_chunks= [r["content"] for r in rows if r.get("section") == "summary"]

    skills_text     = " ".join(skills_chunks)[:600]
    experience_text = " ".join(exp_chunks + summary_chunks)[:600]

    return {
        "skills_text": skills_text,
        "experience_text": experience_text,
        "has_cv": True,
    }


def _was_nudged_recently(user_id: str, hours: int = 20) -> bool:
    """True if the user already got a nudge in the last `hours` hours."""
    cutoff = (_utcnow() - timedelta(hours=hours)).isoformat()
    rows = (
        supabase.table("nudges")
        .select("id")
        .eq("user_id", user_id)
        .gte("created_at", cutoff)
        .limit(1)
        .execute()
        .data or []
    )
    return len(rows) > 0


# ──────────────────────────────────────────────
# public API
# ──────────────────────────────────────────────

def build_user_context(user_id: str) -> dict:
    """
    Returns a single flat dict with every signal the nudge engine needs.
    Safe — will never raise; returns partial data on sub-fetch failures.
    """
    ctx: dict = {"user_id": user_id}

    try:
        ctx.update(_fetch_application_stats(user_id))
    except Exception as exc:
        logger.error("app stats failed for %s: %s", user_id, exc)
        ctx.update({
            "total_applications": 0, "applications_this_week": 0,
            "days_since_last_applied": None, "status_counts": {},
            "recent_companies": [],
        })

    try:
        ctx.update(_fetch_goal_stats(user_id))
    except Exception as exc:
        logger.error("goal stats failed for %s: %s", user_id, exc)
        ctx.update({
            "total_goals": 0, "completed_goals": 0, "pending_goals": 0,
            "overdue_goals": 0, "due_soon_goals": [], "completion_rate_pct": 0,
        })

    try:
        ctx.update(_fetch_task_stats(user_id))
    except Exception as exc:
        logger.error("task stats failed for %s: %s", user_id, exc)
        ctx.update({
            "total_tasks": 0, "completed_tasks": 0, "overdue_tasks": 0,
            "due_today_tasks": [], "due_soon_tasks": [],
        })

    try:
        ctx.update(_fetch_cv_highlights(user_id))
    except Exception as exc:
        logger.error("cv highlights failed for %s: %s", user_id, exc)
        ctx.update({"skills_text": "", "experience_text": "", "has_cv": False})

    return ctx