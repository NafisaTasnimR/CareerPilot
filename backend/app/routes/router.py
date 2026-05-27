from fastapi import APIRouter

from app.routes import cv_ingest

api_router = APIRouter()
api_router.include_router(cv_ingest.router)
