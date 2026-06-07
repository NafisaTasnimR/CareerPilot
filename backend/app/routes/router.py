from fastapi import APIRouter
from app.routes import assistant, cv_ingest, kanban, calendar, progress
from app.routes.nudges_router import router as nudges_router
from app.routes import assistant, cv_ingest, kanban, calendar, progress
from app.routes import job_hunter 

api_router = APIRouter()

api_router.include_router(cv_ingest.router)
api_router.include_router(assistant.router)
api_router.include_router(kanban.router)
api_router.include_router(calendar.router)
api_router.include_router(progress.router)
api_router.include_router(nudges_router)
api_router.include_router(job_hunter.router)
