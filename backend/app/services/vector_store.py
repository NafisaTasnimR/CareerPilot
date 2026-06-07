from uuid import uuid4

from app.db import supabase


COLLECTION_NAME = "cv_embeddings"


def _execute(query, error_message: str):
    try:
        result = query.execute()
    except Exception as exc:
        raise ValueError(f"{error_message}: {exc}") from exc

    error = getattr(result, "error", None)
    if error:
        raise ValueError(f"{error_message}: {error}")

    return result


def _as_rows(result) -> list[dict]:
    data = getattr(result, "data", None)
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if isinstance(data, dict):
        return [data]
    return []


def _row_to_metadata(row: dict) -> dict:
    metadata = {
        "source": row.get("source"),
        "section": row.get("section"),
    }
    candidate_id = row.get("candidate_id")
    if candidate_id is not None:
        metadata["candidate_id"] = candidate_id
    return metadata


def add_embeddings(
    texts: list[str], embeddings: list[list[float]], metadatas: list[dict]
) -> dict:
    if len(texts) != len(embeddings):
        raise ValueError("Texts and embeddings length mismatch")
    if len(texts) != len(metadatas):
        raise ValueError("Texts and metadata length mismatch")

    rows = []
    ids = []
    for text, embedding, metadata in zip(texts, embeddings, metadatas):
        source = (metadata or {}).get("source")
        section = (metadata or {}).get("section")
        if not source:
            raise ValueError("source is required for each embedding row")
        if not section:
            raise ValueError("section is required for each embedding row")

        row_id = str(uuid4())
        ids.append(row_id)
        rows.append(
            {
                "id": row_id,
                "source": source,
                "section": section,
                "candidate_id": (metadata or {}).get("candidate_id"),
                "content": text,
                "embedding": embedding,
            }
        )

    _execute(
        supabase.table(COLLECTION_NAME).insert(rows),
        "Failed to insert embeddings into Supabase",
    )
    return {"ids": ids, "collection": COLLECTION_NAME}


def get_embeddings_by_source(source: str) -> dict:
    result = _execute(
        supabase.table(COLLECTION_NAME)
        .select("id, source, section, candidate_id, content")
        .eq("source", source)
        .order("created_at", desc=False),
        f"Failed to fetch embeddings for source {source}",
    )

    rows = _as_rows(result)
    return {
        "ids": [row.get("id") for row in rows if row.get("id")],
        "documents": [row.get("content", "") for row in rows],
        "metadatas": [_row_to_metadata(row) for row in rows],
        "collection": COLLECTION_NAME,
    }


def query_embeddings(query_embedding: list[float], n_results: int = 8, source: str | None = None) -> dict:
    print(f"Embedding type: {type(query_embedding)}")
    print(f"First few values: {query_embedding[:3]}")
    params = {
        "query_embedding": query_embedding,
        "match_count": max(1, n_results),
        "filter_source": source,
    }
    result = _execute(
        supabase.rpc("match_cv_embeddings", params),
        "Failed to query Supabase vector matches",
    )

    rows = _as_rows(result)
    return {
        "ids": [row.get("id") for row in rows if row.get("id")],
        "documents": [row.get("content", "") for row in rows],
        "metadatas": [_row_to_metadata(row) for row in rows],
        "distances": [row.get("distance") for row in rows],
        "collection": COLLECTION_NAME,
    }
