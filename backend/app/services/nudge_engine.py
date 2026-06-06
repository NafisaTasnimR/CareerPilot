"""
nudge_engine.py

The single public entry point for the entire nudge system.

  generate_and_store_nudge(user_id)  →  dict (the saved nudge row)

Orchestration order:
  1. Check cooldown  — don't nudge if user was nudged < 20 hours ago
  2. Build context   — assemble all user data
  3. Detect event    — pick the highest-priority situation
  4. Build prompt    — construct a fact-rich Gemini prompt
  5. Generate text   — call Gemini
  6. Store nudge     — write to Supabase nudges table
  7. Return          — the saved row (id, message, event_type, etc.)

Every nudge row now stores event_type and a short context_summary so
the frontend can show WHY a nudge was sent (great for demos).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from app.db import supabase
from app.services.gemini import generate_text
from app.services.nudge_context import build_user_context, _was_nudged_recently
from app.services.nudge_events import detect_nudge_event
from app.services.nudge_prompts import build_nudge_prompt

logger = logging.getLogger(__name__)

_GEMINI_MODEL = "gemini-2.0-flash"

# ── Fallback messages per event_type (used when Gemini fails) ────────────────

_FALLBACKS: dict[str, str] = {
    "deadline_today":
        "You have something due today — a quick focused session now will get it done.",
    "deadline_soon":
        "A deadline is coming up in the next couple of days. "
        "Block some time today so you're not rushing at the last minute.",
    "goal_overdue":
        "One of your goals has slipped past its deadline — "
        "revisit it today and set a new realistic target.",
    "applications_behind":
        "You're a little behind on applications this week. "
        "Sending just one more today will keep your momentum strong.",
    "long_inactive":
        "It's been a while since your last application. "
        "Even a single submission today breaks the pause and keeps you moving forward.",
    "first_application":
        "Your first job application is the hardest — and it only takes a few minutes. "
        "Pick one role today and hit submit.",
    "tasks_overdue":
        "A few tasks have piled up past their due dates. "
        "Clearing even one today will give you a real sense of progress.",
    "milestone_close":
        "You're so close to completing all your goals — "
        "finishing just one more will get you over the line.",
    "light_inactive":
        "You've been quiet on applications for a few days. "
        "A quick browse today might surface the perfect opportunity.",
    "general_momentum":
        "You're making real progress on your career journey — "
        "keep the momentum going with one small action today.",
}


def _clean_message(text: str) -> str:
    """Strip markdown artifacts Gemini sometimes adds."""
    return (
        text.replace("**", "")
            .replace("__", "")
            .replace("## ", "")
            .replace("# ", "")
            .strip()
    )


def generate_and_store_nudge(user_id: str, force: bool = False) -> dict:
    """
    Main entry point.

    Args:
        user_id: the user to nudge
        force:   skip cooldown check (useful for on-demand API calls)

    Returns:
        The Supabase nudges row as a dict, including:
          id, user_id, message, event_type, context_summary, seen, created_at
    """

    # ── 1. Cooldown guard ────────────────────────────────────────────────────
    if not force and _was_nudged_recently(user_id, hours=20):
        logger.info("Skipping nudge for %s — nudged recently.", user_id)
        return {}

    # ── 2. Build context ─────────────────────────────────────────────────────
    ctx = build_user_context(user_id)
    logger.info(
        "Context for %s: apps_week=%s, days_since=%s, pending_goals=%s",
        user_id,
        ctx.get("applications_this_week"),
        ctx.get("days_since_last_applied"),
        ctx.get("pending_goals"),
    )

    # ── 3. Detect event ──────────────────────────────────────────────────────
    event = detect_nudge_event(ctx)
    logger.info("Event for %s: %s (priority=%s)", user_id, event.event_type, int(event.priority))

    # ── 4. Build prompt ──────────────────────────────────────────────────────
    prompt = build_nudge_prompt(event, ctx)

    # ── 5. Generate text ─────────────────────────────────────────────────────
    try:
        raw_message = generate_text(prompt, model=_GEMINI_MODEL)
        message = _clean_message(raw_message)
    except Exception as exc:
        logger.warning("Gemini failed for %s (%s), using fallback: %s", user_id, event.event_type, exc)
        message = _FALLBACKS.get(event.event_type, _FALLBACKS["general_momentum"])

    # ── 6. Build a short context_summary for the frontend ───────────────────
    context_summary = _build_context_summary(event, ctx)

    # ── 7. Store in Supabase ─────────────────────────────────────────────────
    insert_payload = {
        "user_id": user_id,
        "message": message,
        "event_type": event.event_type,
        "context_summary": context_summary,
        "seen": False,
    }

    try:
        result = supabase.table("nudges").insert(insert_payload).execute()
        saved = result.data[0] if result.data else insert_payload
        logger.info("Nudge stored for %s: %s", user_id, saved.get("id", "unknown"))
        return saved
    except Exception as exc:
        # Likely means event_type / context_summary columns don't exist yet.
        # Fall back to inserting just the original columns.
        logger.warning("Full insert failed, trying minimal insert: %s", exc)
        minimal = {
            "user_id": user_id,
            "message": message,
            "seen": False,
        }
        result = supabase.table("nudges").insert(minimal).execute()
        return result.data[0] if result.data else minimal


def _build_context_summary(event, ctx: dict) -> str:
    """
    A one-line human-readable summary shown in the frontend nudge card
    so the user understands why this nudge was sent.
    """
    templates = {
        "deadline_today":      "You have a deadline today.",
        "deadline_soon":       "A deadline is coming up in 2-3 days.",
        "goal_overdue":        f"{ctx.get('overdue_goals', 1)} goal(s) passed their deadline.",
        "applications_behind": f"Only {ctx.get('applications_this_week', 0)} application(s) this week.",
        "long_inactive":       f"No application in {ctx.get('days_since_last_applied', '?')} days.",
        "first_application":   "You haven't applied to any jobs yet.",
        "tasks_overdue":       f"{ctx.get('overdue_tasks', 0)} task(s) are overdue.",
        "milestone_close":     f"You've completed {ctx.get('completion_rate_pct', 0)}% of your goals.",
        "light_inactive":      f"No application in {ctx.get('days_since_last_applied', '?')} days.",
        "general_momentum":    f"{ctx.get('total_applications', 0)} total applications submitted.",
    }
    return templates.get(event.event_type, "Keeping you on track.")