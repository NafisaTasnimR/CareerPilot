import os
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import get_settings
from app.db import supabase
from app.schemas.cv import CVChunkItem, CVEmbeddedDataResponse, CVEmbeddedSection, CVIngestResponse, CVUploadResponse
from app.services.cv_chunker import chunk_sections_from_sections, extract_section_segments, infer_section_from_text, normalize_section_name
from app.services.cv_parser import parse_file
from app.services.embeddings import embed_texts
from app.services.cv_structurer import structure_resume_text
from app.services.vector_store import add_embeddings, get_embeddings_by_source
from app.utils.files import save_bytes_to_temp, save_upload_to_temp

router = APIRouter(prefix="/cv", tags=["cv"])


@router.post("/upload", response_model=CVUploadResponse)
async def upload_cv(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="File is empty")

    settings = get_settings()
    safe_name = os.path.basename(file.filename)
    file_id = f"{uuid4()}_{safe_name}"
    try:
        result = supabase.storage.from_(settings.supabase_bucket).upload(
            file_id,
            contents,
            {"content-type": file.content_type or "application/octet-stream"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Upload failed") from exc

    error = None
    if isinstance(result, dict):
        error = result.get("error")
    elif hasattr(result, "error"):
        error = result.error

    if error:
        raise HTTPException(status_code=500, detail=f"Upload failed: {error}")

    return CVUploadResponse(file_id=file_id, file_name=file.filename)


@router.post("/ingest", response_model=CVIngestResponse)
async def ingest_cv(
    file: UploadFile | None = File(None),
    file_id: str | None = None,
    candidate_id: str | None = None,
):
    if not file and not file_id:
        raise HTTPException(status_code=400, detail="File or file_id is required")

    temp_path = None
    filename = ""
    source_id = file_id
    if file_id:
        settings = get_settings()
        filename = os.path.basename(file_id)
        if not filename:
            raise HTTPException(status_code=400, detail="Invalid file_id")
        if not file:
            try:
                downloaded = supabase.storage.from_(settings.supabase_bucket).download(file_id)
            except Exception as exc:
                raise HTTPException(status_code=500, detail="Download failed") from exc
            if not downloaded:
                raise HTTPException(status_code=404, detail="File not found in storage")
            temp_path = save_bytes_to_temp(downloaded, filename)
    if file:
        if not file or not file.filename:
            raise HTTPException(status_code=400, detail="File name is required")
        filename = file.filename
        temp_path = save_upload_to_temp(file)
        if not source_id:
            source_id = filename

    if not source_id:
        source_id = filename

    try:
        text = parse_file(temp_path, filename)
        structured_sections = structure_resume_text(text)
        chunks = chunk_sections_from_sections(structured_sections)
        if not chunks:
            chunks = chunk_sections_from_sections({"general": text})
        if not chunks:
            raise HTTPException(status_code=400, detail="No text extracted from file")

        texts = [chunk["text"] for chunk in chunks]
        embeddings = embed_texts(texts)
        metadatas = []
        for chunk in chunks:
            metadata = {"section": chunk["section"], "source": source_id}
            if candidate_id:
                metadata["candidate_id"] = candidate_id
            metadatas.append(metadata)

        result = add_embeddings(texts, embeddings, metadatas)
        return CVIngestResponse(
            file_name=filename,
            chunk_count=len(texts),
            collection=result["collection"],
            ids=result["ids"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        if temp_path:
            try:
                os.remove(temp_path)
            except OSError:
                pass


@router.get("/embedded-data", response_model=CVEmbeddedDataResponse)
async def get_cv_embedded_data(file_id: str):
    if not file_id.strip():
        raise HTTPException(status_code=400, detail="file_id is required")

    result = get_embeddings_by_source(file_id)
    if not result.get("documents"):
        fallback_source = os.path.basename(file_id)
        if fallback_source and fallback_source != file_id:
            result = get_embeddings_by_source(fallback_source)
    documents = result.get("documents", [])
    metadatas = result.get("metadatas", [])

    if not documents:
        raise HTTPException(status_code=404, detail="Embedded CV data not found")

    section_order = ["name", "contact", "summary", "experience", "education", "skills", "projects", "certifications", "general"]
    grouped: dict[str, list[CVChunkItem]] = {}

    for document, metadata in zip(documents, metadatas):
        section = normalize_section_name(metadata.get("section") if isinstance(metadata, dict) else None)
        document_text = str(document or "")
        segments = extract_section_segments(document_text)

        if segments:
            for segment in segments:
                segment_section = normalize_section_name(segment["section"])
                grouped.setdefault(segment_section, []).append(
                    CVChunkItem(section=segment_section, content=segment["text"])
                )
            continue

        if section == "general":
            section = infer_section_from_text(document_text, fallback=section)

        grouped.setdefault(section, []).append(
            CVChunkItem(section=section, content=document_text)
        )

    ordered_sections: list[CVEmbeddedSection] = []
    for section in section_order:
        items = grouped.pop(section, None)
        if items:
            ordered_sections.append(CVEmbeddedSection(section=section, items=items))

    for section in sorted(grouped.keys()):
        ordered_sections.append(CVEmbeddedSection(section=section, items=grouped[section]))

    return CVEmbeddedDataResponse(
        file_id=file_id,
        chunk_count=len(documents),
        collection=result["collection"],
        sections=ordered_sections,
    )
