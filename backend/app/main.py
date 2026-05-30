from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import kanban, calendar, progress, nudges
from app.scheduler import start_scheduler

from app.routes.router import api_router

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(kanban.router)
app.include_router(calendar.router)
app.include_router(progress.router)
app.include_router(nudges.router)

@app.on_event("startup")
def startup():
    start_scheduler()
app.include_router(api_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Backend running"}