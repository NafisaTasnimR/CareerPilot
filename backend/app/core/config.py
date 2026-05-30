import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    supabase_bucket: str
    chroma_persist_dir: str
    chroma_collection: str


def get_settings() -> Settings:
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is required")

    supabase_bucket = os.getenv("SUPABASE_BUCKET", "cvs").strip() or "cvs"
    chroma_persist_dir = os.getenv("CHROMA_PERSIST_DIR", "chroma_data")
    chroma_collection = os.getenv("CHROMA_COLLECTION", "cv_embeddings")
    return Settings(
        gemini_api_key=gemini_api_key,
        supabase_bucket=supabase_bucket,
        chroma_persist_dir=chroma_persist_dir,
        chroma_collection=chroma_collection,
    )
