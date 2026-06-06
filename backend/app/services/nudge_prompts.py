"""
nudge_prompts.py

Translates a NudgeEvent + user context into a precise Gemini prompt.

Design principle:
  The LLM is only responsible for *wording*.
  Every fact in the prompt comes from real data.
  Gemini never decides WHAT to say — only HOW to say it.
"""

from __future__ import annotations

from app.services.nudge_events import NudgeEvent


# ──────────────────────────────────────────────
# shared system block
# ──────────────────────────────────────────────

_SYSTEM = """\
You are CareerPilot, a friendly and smart career co-pilot.
Write a short, personalized nudge message for a job seeker.

Rules:
- Maximum 2 sentences, under 55 words total.
- Warm and encouraging — never guilt-tripping.
- Reference the specific facts given; do not invent new data.
- End with one clear, concrete action the user can take right now.
- Plain text only — no markdown, no bullet points.
"""


# ──────────────────────────────────────────────
# per-event prompt builders
# ──────────────────────────────────────────────

def _skill_snippet(ctx: dict) -> str:
    skills = ctx.get("skills_text", "").strip()
    if not skills:
        return ""
    # keep it short — first 120 chars of the skills chunk
    short = skills[:120].rstrip(",").strip()
    return f"\nUser's top skills (from CV): {short}."


def _prompt_deadline_today(event: NudgeEvent, ctx: dict) -> str:
    items = event.payload.get("due_items", [])
    items_str = ", ".join(f'"{i}"' for i in items[:2])
    return (
        f"{_SYSTEM}\n\n"
        f"Situation: The user has a deadline TODAY.\n"
        f"Due items: {items_str}.\n"
        f"Total pending goals: {ctx.get('pending_goals', 0)}.\n"
        f"{_skill_snippet(ctx)}\n\n"
        f"Write the nudge now:"
    )


def _prompt_deadline_soon(event: NudgeEvent, ctx: dict) -> str:
    items = event.payload.get("due_items", [])
    items_str = ", ".join(f'"{i}"' for i in items[:2])
    return (
        f"{_SYSTEM}\n\n"
        f"Situation: The user has items due in the next 2-3 days.\n"
        f"Due soon: {items_str}.\n"
        f"{_skill_snippet(ctx)}\n\n"
        f"Write the nudge now:"
    )


def _prompt_goal_overdue(event: NudgeEvent, ctx: dict) -> str:
    overdue = event.payload.get("overdue_count", 1)
    return (
        f"{_SYSTEM}\n\n"
        f"Situation: The user has {overdue} overdue goal(s) that passed their deadline.\n"
        f"Completed goals so far: {ctx.get('completed_goals', 0)} of "
        f"{ctx.get('total_goals', 0)} total.\n"
        f"{_skill_snippet(ctx)}\n\n"
        f"Write the nudge now:"
    )


def _prompt_applications_behind(event: NudgeEvent, ctx: dict) -> str:
    this_week = event.payload.get("applications_this_week", 0)
    total     = event.payload.get("total_applications", 0)
    return (
        f"{_SYSTEM}\n\n"
        f"Situation: The user is behind on job applications this week.\n"
        f"Applications this week: {this_week}.\n"
        f"All-time applications: {total}.\n"
        f"{_skill_snippet(ctx)}\n\n"
        f"Write the nudge now:"
    )


def _prompt_long_inactive(event: NudgeEvent, ctx: dict) -> str:
    days    = event.payload.get("days_inactive", 7)
    pending = event.payload.get("pending_goals", 0)
    return (
        f"{_SYSTEM}\n\n"
        f"Situation: The user has not applied to any job in {days} days.\n"
        f"They still have {pending} pending career goal(s).\n"
        f"All-time applications: {ctx.get('total_applications', 0)}.\n"
        f"{_skill_snippet(ctx)}\n\n"
        f"Write the nudge now:"
    )


def _prompt_first_application(event: NudgeEvent, ctx: dict) -> str:
    has_cv = ctx.get("has_cv", False)
    cv_line = (
        "They have already uploaded their CV."
        if has_cv
        else "They haven't uploaded a CV yet — that's a great first step too."
    )
    return (
        f"{_SYSTEM}\n\n"
        f"Situation: The user hasn't applied to any job yet.\n"
        f"{cv_line}\n"
        f"{_skill_snippet(ctx)}\n\n"
        f"Write the nudge now:"
    )


def _prompt_tasks_overdue(event: NudgeEvent, ctx: dict) -> str:
    overdue = event.payload.get("overdue_tasks", 2)
    return (
        f"{_SYSTEM}\n\n"
        f"Situation: The user has {overdue} overdue tasks that are blocking their progress.\n"
        f"Completed tasks so far: {ctx.get('completed_tasks', 0)} of "
        f"{ctx.get('total_tasks', 0)}.\n"
        f"{_skill_snippet(ctx)}\n\n"
        f"Write the nudge now:"
    )


def _prompt_milestone_close(event: NudgeEvent, ctx: dict) -> str:
    rate      = event.payload.get("completion_rate_pct", 80)
    remaining = event.payload.get("remaining_goals", 1)
    return (
        f"{_SYSTEM}\n\n"
        f"Situation: The user has completed {rate}% of their goals — "
        f"only {remaining} goal(s) left.\n"
        f"Applications submitted all-time: {ctx.get('total_applications', 0)}.\n"
        f"{_skill_snippet(ctx)}\n\n"
        f"Write the nudge now:"
    )


def _prompt_light_inactive(event: NudgeEvent, ctx: dict) -> str:
    days = event.payload.get("days_inactive", 4)
    return (
        f"{_SYSTEM}\n\n"
        f"Situation: The user hasn't applied in {days} days — a small dip in momentum.\n"
        f"All-time applications: {ctx.get('total_applications', 0)}.\n"
        f"Pending goals: {ctx.get('pending_goals', 0)}.\n"
        f"{_skill_snippet(ctx)}\n\n"
        f"Write the nudge now:"
    )


def _prompt_general_momentum(event: NudgeEvent, ctx: dict) -> str:
    total   = event.payload.get("total_applications", 0)
    pending = ctx.get("pending_goals", 0)
    return (
        f"{_SYSTEM}\n\n"
        f"Situation: The user is actively working on their career journey.\n"
        f"Applications submitted: {total}.\n"
        f"Pending goals: {pending}.\n"
        f"{_skill_snippet(ctx)}\n\n"
        f"Write the nudge now:"
    )


# ──────────────────────────────────────────────
# router
# ──────────────────────────────────────────────

_PROMPT_MAP = {
    "deadline_today":      _prompt_deadline_today,
    "deadline_soon":       _prompt_deadline_soon,
    "goal_overdue":        _prompt_goal_overdue,
    "applications_behind": _prompt_applications_behind,
    "long_inactive":       _prompt_long_inactive,
    "first_application":   _prompt_first_application,
    "tasks_overdue":       _prompt_tasks_overdue,
    "milestone_close":     _prompt_milestone_close,
    "light_inactive":      _prompt_light_inactive,
    "general_momentum":    _prompt_general_momentum,
}


def build_nudge_prompt(event: NudgeEvent, ctx: dict) -> str:
    """
    Returns the full prompt string to send to Gemini.
    Falls back to general_momentum if event_type is unknown.
    """
    builder = _PROMPT_MAP.get(event.event_type, _prompt_general_momentum)
    return builder(event, ctx)