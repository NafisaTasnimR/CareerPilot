from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
import firebase_admin
from firebase_admin import auth as firebase_auth

from app.db import supabase
from app.models import User as UserModel

router = APIRouter(prefix="/calendar", tags=["calendar"])
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    try:
        decoded_token = firebase_auth.verify_id_token(token, clock_skew_seconds=60)
        uid = decoded_token['uid']
        
        result = supabase.table("users").select("*").eq("firebase_uid", uid).single().execute()
        if not result.data:
            raise HTTPException(status_code=401, detail="User not found")
        return result.data
    except firebase_admin.exceptions.FirebaseError as e:
        raise HTTPException(status_code=401, detail=f"Firebase error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

class GoalCreate(BaseModel):
    title: str
    deadline: Optional[str] = None

class TaskCreate(BaseModel):
    title: str
    goal_id: Optional[str] = None
    due_date: Optional[str] = None

@router.get("/goals")
def get_goals(current_user = Depends(get_current_user)):
    return supabase.table("goals").select("*, tasks(*)").eq("user_id", current_user["firebase_uid"]).execute().data

@router.post("/goals")
def create_goal(goal: GoalCreate, current_user = Depends(get_current_user)):
    data = {"title": goal.title, "user_id": current_user["firebase_uid"]}
    if goal.deadline:
        data["deadline"] = goal.deadline
    return supabase.table("goals").insert(data).execute().data[0]

@router.patch("/goals/{goal_id}")
def complete_goal(goal_id: str, completed: bool, current_user = Depends(get_current_user)):
    uid = current_user["firebase_uid"]
    # Verify ownership
    res = supabase.table("goals").select("*").eq("id", goal_id).eq("user_id", uid).execute()
    if not res.data:
        raise HTTPException(403, "Goal not found or unauthorized")
    # Update the goal
    updated_goal = supabase.table("goals").update({"completed": completed}).eq("id", goal_id).execute().data[0]
    # Cascade: marking goal done auto-completes all its tasks.
    # Un-marking leaves tasks as-is (user may have intentionally completed some).
    if completed:
        supabase.table("tasks").update({"completed": True}).eq("goal_id", goal_id).eq("user_id", uid).execute()
    return updated_goal

@router.get("/tasks")
def get_tasks(current_user = Depends(get_current_user)):
    return supabase.table("tasks").select("*").eq("user_id", current_user["firebase_uid"]).execute().data

@router.post("/tasks")
def create_task(task: TaskCreate, current_user = Depends(get_current_user)):
    data = {"title": task.title, "user_id": current_user["firebase_uid"]}
    if task.due_date:
        data["due_date"] = task.due_date
    if task.goal_id:
        data["goal_id"] = task.goal_id
    return supabase.table("tasks").insert(data).execute().data[0]

@router.patch("/tasks/{task_id}/complete")
def complete_task(task_id: str, completed: bool, current_user = Depends(get_current_user)):
    # Verify ownership
    res = supabase.table("tasks").select("*").eq("id", task_id).eq("user_id", current_user["firebase_uid"]).execute()
    if not res.data:
        raise HTTPException(403, "Task not found or unauthorized")
    return supabase.table("tasks").update({"completed": completed}).eq("id", task_id).execute().data[0]

@router.delete("/goals/{goal_id}")
def delete_goal(goal_id: str, current_user = Depends(get_current_user)):
    # Delete tasks first (if no cascade set in DB)
    supabase.table("tasks").delete().eq("goal_id", goal_id).execute()
    supabase.table("goals").delete().eq("id", goal_id).execute()
    return {"deleted": goal_id}

@router.delete("/tasks/{task_id}")
def delete_task(task_id: str):
    supabase.table("tasks").delete().eq("id", task_id).execute()
    return {"deleted": task_id}