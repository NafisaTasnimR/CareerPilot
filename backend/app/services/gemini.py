from google import genai
from google.genai import types

from app.core.config import get_settings

DEFAULT_EMBEDDING_DIMENSION = 768

# Global client to avoid repeated creation/destruction
_client: genai.Client | None = None

def get_client() -> genai.Client:
    global _client
    if _client is None:
        settings = get_settings()
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client

def generate_text(prompt: str, model: str) -> str:
    client = get_client()
    response = client.models.generate_content(model=model, contents=prompt)
    text = (getattr(response, "text", "") or "").strip()
    if not text:
        raise ValueError("Gemini returned empty response")
    return text

def _extract_embedding_values(response: object) -> list[float]:
    # The response contains an 'embeddings' list of ContentEmbedding objects
    embeddings = getattr(response, "embeddings", None)
    if embeddings is None and isinstance(response, dict):
        embeddings = response.get("embeddings")
    if not embeddings:
        return []
    
    # Get the first embedding (batch of 1)
    first_embedding = embeddings[0] if isinstance(embeddings, list) else embeddings
    
    # Extract the values attribute
    if hasattr(first_embedding, "values"):
        values = first_embedding.values
    elif isinstance(first_embedding, dict):
        values = first_embedding.get("values")
    else:
        values = first_embedding
    
    return values if isinstance(values, list) else []


def embed_text(text: str, model: str = "gemini-embedding-2") -> list[float]:
    client = get_client()
    try:
        response = client.models.embed_content(
            model=model, 
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=768)
        )
        embedding = _extract_embedding_values(response)
        if not embedding:
            print(f"Gemini API returned empty embedding for text: {text[:50]}...")
        return embedding
    except Exception as e:
        print(f"Gemini embed_content error: {str(e)}")
        return []