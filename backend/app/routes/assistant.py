from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import firebase_admin
from firebase_admin import auth as firebase_auth

from app.db import supabase
from app.models import User as UserModel
from app.schemas.assistant import AssistantResponse, QueryRequest
from app.services.assistant import run_assistant_query

import traceback

router = APIRouter(prefix="/assistant", tags=["assistant"])
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


@router.post("/", response_model=AssistantResponse)
def assistant(req: QueryRequest, current_user = Depends(get_current_user)):
    query = req.query.strip()
    print(f"Received assistant query: {query}")
    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    try:
        intent, response_text, structured_cv_context = run_assistant_query(
            query=query,
            job_description=req.job_description,
            file_id=req.file_id,
            top_k=req.top_k,
            history=req.history,
        )
        return AssistantResponse(
            intent=intent,
            response=response_text,
            structured_cv_context=structured_cv_context,
        )
    except ValueError as exc:
        print(f"ValueError in assistant: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        print(f"Unexpected error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Assistant request failed") from exc
