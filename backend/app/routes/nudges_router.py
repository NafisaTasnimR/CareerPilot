"""
nudges_router.py  — Firebase-auth protected nudge endpoints

Endpoints:
  POST /nudges/generate       — on-demand nudge for the authenticated user
  GET  /nudges/               — list nudges for the authenticated user
  GET  /nudges/latest         — single latest nudge (auto-marks seen)
  PATCH /nudges/{nudge_id}/seen  — mark as read
  DELETE /nudges/{nudge_id}   — delete
  GET  /nudges/context        — debug: raw context (dev only)
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth as firebase_auth

from app.db import supabase
from app.services.nudge_engine import generate_and_store_nudge
from app.services.nudge_context import build_user_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/nudges", tags=["nudges"])
security = HTTPBearer()


# ── auth dependency ───────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Verify Firebase ID token and return the Supabase user record."""
    token = credentials.credentials
    try:
        decoded_token = firebase_auth.verify_id_token(token, clock_skew_seconds=60)
        uid = decoded_token["uid"]

        result = (
            supabase.table("users")
            .select("*")
            .eq("firebase_uid", uid)
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=401, detail="User not found")
        return result.data

    except firebase_admin.exceptions.FirebaseError as e:
        raise HTTPException(status_code=401, detail=f"Firebase error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")


# ── POST /nudges/generate ─────────────────────────────────────────────────────

@router.post("/generate")
def generate_nudge(current_user: dict = Depends(get_current_user)):
    """
    On-demand nudge generation for the authenticated user.
    Always generates (force=True — bypasses the 20h cooldown).
    """
    user_id = current_user["firebase_uid"]
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
    seen: bool | None = Query(None, description="Filter by seen status"),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """Return nudge history for the authenticated user, newest first."""
    user_id = current_user["firebase_uid"]
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
def get_latest_nudge(current_user: dict = Depends(get_current_user)):
    """
    Returns the single most recent nudge for the widget popup.
    Auto-marks it as seen.
    """
    user_id = current_user["firebase_uid"]
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

    if not nudge.get("seen"):
        supabase.table("nudges").update({"seen": True}).eq("id", nudge["id"]).execute()
        nudge["seen"] = True

    return nudge


# ── PATCH /nudges/{nudge_id}/seen ─────────────────────────────────────────────

@router.patch("/{nudge_id}/seen")
def mark_seen(nudge_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["firebase_uid"]
    # Verify ownership before updating
    res = (
        supabase.table("nudges")
        .select("*")
        .eq("id", nudge_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Nudge not found or unauthorized")
    updated = supabase.table("nudges").update({"seen": True}).eq("id", nudge_id).execute()
    return updated.data[0]


# ── DELETE /nudges/{nudge_id} ─────────────────────────────────────────────────

@router.delete("/{nudge_id}")
def delete_nudge(nudge_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["firebase_uid"]
    # Verify ownership before deleting
    res = (
        supabase.table("nudges")
        .select("*")
        .eq("id", nudge_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Nudge not found or unauthorized")
    supabase.table("nudges").delete().eq("id", nudge_id).execute()
    return {"deleted": nudge_id}


# ── GET /nudges/context ───────────────────────────────────────────────────────

@router.get("/context")
def get_nudge_context(current_user: dict = Depends(get_current_user)):
    """
    DEV / DEMO endpoint — shows the raw context the nudge engine sees.
    Remove or add role-gating in production.
    """
    user_id = current_user["firebase_uid"]
    try:
        ctx = build_user_context(user_id)
        return ctx
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc