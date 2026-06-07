from app.services.gemini import DEFAULT_EMBEDDING_DIMENSION, embed_text


def embed_texts(texts: list[str], max_batch_size: int = 5) -> list[list[float]]:
    """
    Embed texts using Google's embedding model.
    
    Args:
        texts: List of texts to embed
        max_batch_size: Maximum batch size to prevent memory issues (default: 5)
    
    Returns:
        List of embeddings
    """
    if not texts:
        return []

    embeddings: list[list[float]] = []
    
    # Process in batches to avoid memory exhaustion
    for i in range(0, len(texts), max_batch_size):
        batch = texts[i : i + max_batch_size]
        for text in batch:
            try:
                embedding = embed_text(text, model="gemini-embedding-2")
                if not embedding:
                    raise RuntimeError("Empty embedding response")
                embeddings.append(embedding)
            except Exception as e:
                # Log and skip failed embeddings
                print(f"Warning: Failed to embed text: {str(e)}")
                # Return zero embedding as fallback
                embeddings.append([0.0] * DEFAULT_EMBEDDING_DIMENSION)
    
    return embeddings
