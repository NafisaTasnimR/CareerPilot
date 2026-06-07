from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db import supabase
from app.models import User as UserModel
from app.schemas.user import UserSchema, UserCreate
import firebase_admin
from firebase_admin import auth as firebase_auth

router = APIRouter()
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

@router.post("/users/me")
async def sync_user(user_data: UserCreate):
    # Check if user exists in Supabase
    existing = supabase.table("users").select("*").eq("firebase_uid", user_data.firebase_uid).execute()
    
    if not existing.data:
        # Insert new user
        new_user = {
            "firebase_uid": user_data.firebase_uid,
            "email": user_data.email,
            "full_name": user_data.full_name,
            "is_active": True,
        }
        result = supabase.table("users").insert(new_user).execute()
        user_record = result.data[0] if result.data else None
    else:
        # Update existing user
        user_record = existing.data[0]
        update_data = {
            "email": user_data.email,
            "full_name": user_data.full_name,
        }
        supabase.table("users").update(update_data).eq("firebase_uid", user_data.firebase_uid).execute()
        # Merge updated fields for response
        user_record.update(update_data)
    
    if not user_record:
        raise HTTPException(status_code=500, detail="Failed to sync user")
    
    return UserSchema(
        id=user_record["id"],
        firebase_uid=user_record["firebase_uid"],
        email=user_record["email"],
        full_name=user_record.get("full_name"),
    )

@router.get("/users/me")
async def get_me(current_user=Depends(get_current_user) ):
    return UserSchema.model_validate(current_user)