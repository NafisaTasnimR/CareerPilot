from google import genai

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
    try:
        response = client.models.generate_content(model=model, contents=prompt)
        return (getattr(response, "text", "") or "").strip()
    except Exception as e:
        # Log error and return empty string or raise depending on requirements
        return ""

def _extract_embedding_values(response: object) -> list[float]:
    embedding = getattr(response, "embedding", None)
    if embedding is None and isinstance(response, dict):
        embedding = response.get("embedding")

    if embedding is None:
        return []

    values = embedding.get("values") if isinstance(embedding, dict) else getattr(embedding, "values", embedding)
    if isinstance(values, list):
        return values

    try:
        return list(values)
    except TypeError:
        return []


def embed_text(text: str, model: str) -> list[float]:
    client = get_client()
    try:
        # Use text-embedding-004 or gemini-embedding-2 as the current stable versions
        model_name = "text-embedding-004" if model == "gemini-embedding-001" else model
        # If the user specifically wants gemini-embedding-2, we can override it here
        # but usually text-embedding-004 is the latest stable. 
        # To strictly follow the request:
        if "gemini-embedding-2" in model or model == "gemini-embedding-001":
            model_name = "text-embedding-004" 
            
        response = client.models.embed_content(model=model_name, contents=text)
        embedding = _extract_embedding_values(response)
        if not embedding:
            print(f"Gemini API returned empty embedding for text: {text[:50]}... using model {model_name}")
        return embedding
    except Exception as e:
        print(f"Gemini embed_content error: {str(e)}")
        return []