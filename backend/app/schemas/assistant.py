from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    query: str = Field(min_length=1)
    job_description: str | None = None
    file_id: str | None = None
    top_k: int = Field(default=8, ge=1, le=20)


class AssistantResponse(BaseModel):
    intent: str
    response: str
    structured_cv_context: dict[str, list[str]]
