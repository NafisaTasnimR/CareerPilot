from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.db import supabase

router = APIRouter(prefix="/calendar", tags=["calendar"])

class GoalCreate(BaseModel):
    title: str
    deadline: Optional[str] = None

class TaskCreate(BaseModel):
    title: str
    goal_id: Optional[str] = None
    due_date: Optional[str] = None

@router.get("/goals")
def get_goals(user_id: str):
    return supabase.table("goals").select("*, tasks(*)").eq("user_id", user_id).execute().data

@router.post("/goals")
def create_goal(goal: GoalCreate, user_id: str):
    data = {"title": goal.title, "user_id": user_id}
    if goal.deadline:
        data["deadline"] = goal.deadline
    return supabase.table("goals").insert(data).execute().data[0]

@router.patch("/goals/{goal_id}")
def complete_goal(goal_id: str, completed: bool):
    return supabase.table("goals").update({"completed": completed}).eq("id", goal_id).execute().data[0]

@router.get("/tasks")
def get_tasks(user_id: str):
    return supabase.table("tasks").select("*").eq("user_id", user_id).execute().data

@router.post("/tasks")
def create_task(task: TaskCreate, user_id: str):
    data = {"title": task.title, "user_id": user_id}
    if task.due_date:
        data["due_date"] = task.due_date
    if task.goal_id:
        data["goal_id"] = task.goal_id
    return supabase.table("tasks").insert(data).execute().data[0]

@router.patch("/tasks/{task_id}/complete")
def complete_task(task_id: str, completed: bool):
    return supabase.table("tasks").update({"completed": completed}).eq("id", task_id).execute().data[0]

@router.delete("/goals/{goal_id}")
def delete_goal(goal_id: str):
    # Delete tasks first (if no cascade set in DB)
    supabase.table("tasks").delete().eq("goal_id", goal_id).execute()
    supabase.table("goals").delete().eq("id", goal_id).execute()
    return {"deleted": goal_id}

@router.delete("/tasks/{task_id}")
def delete_task(task_id: str):
    supabase.table("tasks").delete().eq("id", task_id).execute()
    return {"deleted": task_id}