from uuid import uuid4

import chromadb

from app.core.config import get_settings


def _get_collection():
    settings = get_settings()
    client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    return client.get_or_create_collection(name=settings.chroma_collection)


def add_embeddings(
    texts: list[str], embeddings: list[list[float]], metadatas: list[dict]
) -> dict:
    if len(texts) != len(embeddings):
        raise ValueError("Texts and embeddings length mismatch")

    collection = _get_collection()
    ids = [str(uuid4()) for _ in texts]
    collection.add(ids=ids, documents=texts, embeddings=embeddings, metadatas=metadatas)
    return {"ids": ids, "collection": collection.name}


def get_embeddings_by_source(source: str) -> dict:
    collection = _get_collection()
    result = collection.get(where={"source": source}, include=["documents", "metadatas"])
    return {
        "ids": result.get("ids", []),
        "documents": result.get("documents", []),
        "metadatas": result.get("metadatas", []),
        "collection": collection.name,
    }
