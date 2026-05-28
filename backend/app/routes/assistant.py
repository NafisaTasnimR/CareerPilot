from fastapi import APIRouter, HTTPException

from app.schemas.assistant import AssistantResponse, QueryRequest
from app.services.assistant import run_assistant_query

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/", response_model=AssistantResponse)
def assistant(req: QueryRequest):
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    try:
        intent, response_text, structured_cv_context = run_assistant_query(
            query=query,
            job_description=req.job_description,
            file_id=req.file_id,
            top_k=req.top_k,
        )
        return AssistantResponse(
            intent=intent,
            response=response_text,
            structured_cv_context=structured_cv_context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Assistant request failed") from exc
