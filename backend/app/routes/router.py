from fastapi import APIRouter

from app.routes import assistant, cv_ingest

api_router = APIRouter()
api_router.include_router(cv_ingest.router)
api_router.include_router(assistant.router)
