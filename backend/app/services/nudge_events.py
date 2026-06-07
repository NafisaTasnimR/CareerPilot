"""
nudge_events.py

Pure logic layer — zero LLM calls, zero DB calls.

Takes the context dict from nudge_context.build_user_context() and
returns the single highest-priority NudgeEvent that should be acted on.

Design principles:
  1. One nudge at a time — never spam the user.
  2. Every event carries a rich payload so the prompt builder can be
     specific without hallucinating.
  3. Priority is explicit and auditable — easy to tune.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any


# ──────────────────────────────────────────────
# Event taxonomy
# ──────────────────────────────────────────────

class NudgePriority(IntEnum):
    """Higher number = fires first."""
    DEADLINE_TODAY       = 100   # task/goal due today
    DEADLINE_SOON        = 90    # task/goal due in 2-3 days
    GOAL_OVERDUE         = 85    # goal deadline already passed
    APPLICATIONS_BEHIND  = 80    # applied < half of weekly goal by mid-week
    LONG_INACTIVE        = 75    # no application in >7 days with pending goals
    FIRST_APPLICATION    = 70    # user has never applied — onboarding nudge
    STREAK_AT_RISK       = 65    # applied yesterday but not yet today
    TASKS_OVERDUE        = 60    # has overdue tasks piling up
    MILESTONE_CLOSE      = 55    # goal completion rate just crossed 80 %
    LIGHT_INACTIVE       = 40    # no application in 3-7 days
    GENERAL_MOMENTUM     = 10    # fallback when nothing specific fires


@dataclass
class NudgeEvent:
    priority:    NudgePriority
    event_type:  str                       # machine-readable label
    headline:    str                       # 1 sentence — what triggered this
    payload:     dict[str, Any] = field(default_factory=dict)   # extra data for prompt


# ──────────────────────────────────────────────
# Individual event detectors
# ──────────────────────────────────────────────

def _detect_deadline_today(ctx: dict) -> NudgeEvent | None:
    due = ctx.get("due_today_tasks", []) + ctx.get("due_soon_goals", [])
    if not due:
        return None
    item = due[0]
    return NudgeEvent(
        priority=NudgePriority.DEADLINE_TODAY,
        event_type="deadline_today",
        headline=f'"{item}" is due today.',
        payload={"due_items": due[:3]},
    )


def _detect_deadline_soon(ctx: dict) -> NudgeEvent | None:
    due = ctx.get("due_soon_tasks", []) + ctx.get("due_soon_goals", [])
    if not due:
        return None
    item = due[0]
    return NudgeEvent(
        priority=NudgePriority.DEADLINE_SOON,
        event_type="deadline_soon",
        headline=f'"{item}" is due within the next 2-3 days.',
        payload={"due_items": due[:3]},
    )


def _detect_overdue_goal(ctx: dict) -> NudgeEvent | None:
    if ctx.get("overdue_goals", 0) < 1:
        return None
    return NudgeEvent(
        priority=NudgePriority.GOAL_OVERDUE,
        event_type="goal_overdue",
        headline=f'{ctx["overdue_goals"]} goal(s) have passed their deadline.',
        payload={"overdue_count": ctx["overdue_goals"]},
    )


def _detect_applications_behind(ctx: dict) -> NudgeEvent | None:
    """
    We don't store a numeric weekly goal in the DB yet.
    Heuristic: if user has ever applied, assume a goal of 5/week.
    Fire if fewer than 2 applications this week and total > 0
    (meaning they are an active user, just slow this week).
    """
    this_week = ctx.get("applications_this_week", 0)
    total     = ctx.get("total_applications", 0)
    if total == 0 or this_week >= 2:
        return None
    return NudgeEvent(
        priority=NudgePriority.APPLICATIONS_BEHIND,
        event_type="applications_behind",
        headline=f"Only {this_week} application(s) submitted this week.",
        payload={
            "applications_this_week": this_week,
            "total_applications": total,
        },
    )


def _detect_long_inactive(ctx: dict) -> NudgeEvent | None:
    days = ctx.get("days_since_last_applied")
    if days is None or days < 7:
        return None
    pending = ctx.get("pending_goals", 0)
    return NudgeEvent(
        priority=NudgePriority.LONG_INACTIVE,
        event_type="long_inactive",
        headline=f"No application submitted in {days} days.",
        payload={
            "days_inactive": days,
            "pending_goals": pending,
        },
    )


def _detect_first_application(ctx: dict) -> NudgeEvent | None:
    if ctx.get("total_applications", 0) > 0:
        return None
    return NudgeEvent(
        priority=NudgePriority.FIRST_APPLICATION,
        event_type="first_application",
        headline="User has not submitted any applications yet.",
        payload={},
    )


def _detect_tasks_overdue(ctx: dict) -> NudgeEvent | None:
    overdue = ctx.get("overdue_tasks", 0)
    if overdue < 2:
        return None
    return NudgeEvent(
        priority=NudgePriority.TASKS_OVERDUE,
        event_type="tasks_overdue",
        headline=f"{overdue} task(s) are overdue.",
        payload={"overdue_tasks": overdue},
    )


def _detect_milestone_close(ctx: dict) -> NudgeEvent | None:
    rate = ctx.get("completion_rate_pct", 0)
    total = ctx.get("total_goals", 0)
    if total < 2 or rate < 75 or rate >= 100:
        return None
    remaining = ctx.get("pending_goals", 0)
    return NudgeEvent(
        priority=NudgePriority.MILESTONE_CLOSE,
        event_type="milestone_close",
        headline=f"User has completed {rate}% of their goals — so close to finishing.",
        payload={"completion_rate_pct": rate, "remaining_goals": remaining},
    )


def _detect_light_inactive(ctx: dict) -> NudgeEvent | None:
    days = ctx.get("days_since_last_applied")
    if days is None or days < 3 or days >= 7:
        return None
    return NudgeEvent(
        priority=NudgePriority.LIGHT_INACTIVE,
        event_type="light_inactive",
        headline=f"No application submitted in {days} days.",
        payload={"days_inactive": days},
    )


def _detect_general_momentum(ctx: dict) -> NudgeEvent:
    """Always fires — the guaranteed fallback."""
    total = ctx.get("total_applications", 0)
    return NudgeEvent(
        priority=NudgePriority.GENERAL_MOMENTUM,
        event_type="general_momentum",
        headline=f"User has {total} total applications and is making steady progress.",
        payload={"total_applications": total},
    )


# ──────────────────────────────────────────────
# Ordered detector pipeline
# ──────────────────────────────────────────────

_DETECTORS = [
    _detect_deadline_today,
    _detect_deadline_soon,
    _detect_overdue_goal,
    _detect_applications_behind,
    _detect_long_inactive,
    _detect_first_application,
    _detect_tasks_overdue,
    _detect_milestone_close,
    _detect_light_inactive,
    _detect_general_momentum,   # always returns something
]


def detect_nudge_event(ctx: dict) -> NudgeEvent:
    """
    Run every detector, collect all firing events, return the one with
    the highest priority.  _detect_general_momentum guarantees at least
    one event always exists.
    """
    events: list[NudgeEvent] = []

    for detector in _DETECTORS:
        result = detector(ctx)
        if result is not None:
            events.append(result)

    # sort descending by priority, return top
    events.sort(key=lambda e: int(e.priority), reverse=True)
    return events[0]