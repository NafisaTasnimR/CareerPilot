import google.generativeai as genai

from app.core.config import get_settings


def embed_texts(texts: list[str]) -> list[list[float]]:
    settings = get_settings()
    if not texts:
        return []

    genai.configure(api_key=settings.gemini_api_key)
    embeddings: list[list[float]] = []
    for text in texts:
        response = genai.embed_content(
            model="models/gemini-embedding-2",
            content=text,
        )
        embedding = response["embedding"] if isinstance(response, dict) else response.embedding
        embeddings.append(embedding)
    return embeddings
