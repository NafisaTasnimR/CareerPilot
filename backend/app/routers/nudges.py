from fastapi import APIRouter
from app.db import supabase

router = APIRouter(prefix="/nudges", tags=["nudges"])

@router.get("/")
def get_nudges(user_id: str, seen: bool = None):
    query = supabase.table("nudges").select("*").eq("user_id", user_id)
    if seen is not None:
        query = query.eq("seen", seen)
    return query.order("created_at", desc=True).execute().data

@router.patch("/{nudge_id}/seen")
def mark_seen(nudge_id: str):
    res = supabase.table("nudges").update({"seen": True}).eq("id", nudge_id).execute()
    return res.data[0]