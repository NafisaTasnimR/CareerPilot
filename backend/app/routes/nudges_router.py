"""
nudges_router.py  (replaces your existing nudges.py route)

Endpoints:
  POST /nudges/generate?user_id=xxx        — on-demand nudge (force=True)
  GET  /nudges/?user_id=xxx                — list nudges
  GET  /nudges/latest?user_id=xxx          — single latest unseen nudge
  PATCH /nudges/{nudge_id}/seen            — mark as read
  DELETE /nudges/{nudge_id}               — delete
  GET  /nudges/context?user_id=xxx         — debug: show raw context (dev only)
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from app.db import supabase
from app.services.nudge_engine import generate_and_store_nudge
from app.services.nudge_context import build_user_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/nudges", tags=["nudges"])


# ── POST /nudges/generate ─────────────────────────────────────────────────────

@router.post("/generate")
def generate_nudge(user_id: str = Query(..., description="User ID to generate nudge for")):
    """
    On-demand nudge generation.
    Always generates (force=True — bypasses the 20h cooldown).
    Use this from the frontend 'Refresh nudge' button.
    """
    try:
        nudge = generate_and_store_nudge(user_id, force=True)
    except Exception as exc:
        logger.error("generate_nudge failed for %s: %s", user_id, exc)
        raise HTTPException(status_code=500, detail="Failed to generate nudge") from exc

    if not nudge:
        raise HTTPException(status_code=500, detail="Nudge generation returned empty result")

    return nudge


# ── GET /nudges/ ──────────────────────────────────────────────────────────────

@router.get("/")
def get_nudges(
    user_id: str = Query(...),
    seen: bool | None = Query(None, description="Filter by seen status"),
    limit: int = Query(20, ge=1, le=100),
):
    """Return nudge history for the user, newest first."""
    query = (
        supabase.table("nudges")
        .select("*")
        .eq("user_id", user_id)
    )
    if seen is not None:
        query = query.eq("seen", seen)

    return (
        query
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data or []
    )


# ── GET /nudges/latest ────────────────────────────────────────────────────────

@router.get("/latest")
def get_latest_nudge(user_id: str = Query(...)):
    """
    Returns the single most recent nudge for the widget popup.
    Marks it as seen automatically.
    """
    rows = (
        supabase.table("nudges")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data or []
    )

    if not rows:
        return None

    nudge = rows[0]

    # auto-mark seen
    if not nudge.get("seen"):
        supabase.table("nudges").update({"seen": True}).eq("id", nudge["id"]).execute()
        nudge["seen"] = True

    return nudge


# ── PATCH /nudges/{nudge_id}/seen ─────────────────────────────────────────────

@router.patch("/{nudge_id}/seen")
def mark_seen(nudge_id: str):
    res = supabase.table("nudges").update({"seen": True}).eq("id", nudge_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Nudge not found")
    return res.data[0]


# ── DELETE /nudges/{nudge_id} ─────────────────────────────────────────────────

@router.delete("/{nudge_id}")
def delete_nudge(nudge_id: str):
    supabase.table("nudges").delete().eq("id", nudge_id).execute()
    return {"deleted": nudge_id}


# ── GET /nudges/context ───────────────────────────────────────────────────────

@router.get("/context")
def get_nudge_context(user_id: str = Query(...)):
    """
    DEV / DEMO endpoint.
    Returns the raw context object the nudge engine sees for this user.
    Great for showing judges how the system works.
    Remove or protect in production.
    """
    try:
        ctx = build_user_context(user_id)
        return ctx
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc