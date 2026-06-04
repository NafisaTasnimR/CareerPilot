import json
import re

from app.services.cv_chunker import infer_section_from_text, normalize_section_name
from app.services.embeddings import embed_texts
from app.services.gemini import generate_text
from app.services.vector_store import query_embeddings

INTENT_JOB_FIT = "job_fit"
INTENT_SKILL_GAP = "skill_gap"
INTENT_ROADMAP = "roadmap"
INTENT_COVER_LETTER = "cover_letter"
INTENT_GENERAL = "general"

_STRUCTURED_SECTIONS = ("experience", "skills", "education")

STYLE_GUIDANCE = (
    "Tone: friendly, warm, and concise. "
    "If the user greets, makes small talk, or asks unrelated questions, "
    "reply with a short friendly greeting and a reminder that you can only help "
    "with CV, job search, and career topics, then invite a relevant question.\n"
)


def detect_intent(query: str) -> str:
    q = query.strip().lower()

    if any(keyword in q for keyword in ("cover letter", "draft a letter", "write a letter", "application letter")):
        return INTENT_COVER_LETTER

    if any(keyword in q for keyword in ("missing skill", "skill gap", "what skills", "skills am i missing", "missing for")):
        return INTENT_SKILL_GAP

    if any(keyword in q for keyword in ("roadmap", "3-month", "3 month", "weekly plan", "job-ready plan", "job ready plan")):
        return INTENT_ROADMAP

    if any(keyword in q for keyword in ("am i ready", "job fit", "fit for", "qualified", "match this role", "ready for this")):
        return INTENT_JOB_FIT

    return INTENT_GENERAL


def _dedupe_keep_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for item in items:
        normalized = re.sub(r"\s+", " ", item).strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        unique.append(normalized)
    return unique


def build_structured_cv_context_from_matches(
    documents: list[str],
    metadatas: list[dict | None],
) -> dict[str, list[str]]:
    context = {section: [] for section in _STRUCTURED_SECTIONS}

    for index, document in enumerate(documents):
        text = str(document or "").strip()
        if not text:
            continue

        metadata = metadatas[index] if index < len(metadatas) and isinstance(metadatas[index], dict) else {}
        section = normalize_section_name(metadata.get("section"))
        if section not in context:
            inferred = infer_section_from_text(text, fallback="general")
            section = inferred if inferred in context else "general"

        if section in context:
            context[section].append(text)

    for section in context:
        context[section] = _dedupe_keep_order(context[section])

    return context


def retrieve_structured_cv_context(query: str, file_id: str | None = None, top_k: int = 8) -> dict[str, list[str]]:
    query_embedding_list = embed_texts([query.strip()])
    if not query_embedding_list:
        return {section: [] for section in _STRUCTURED_SECTIONS}

    result = query_embeddings(
        query_embedding=query_embedding_list[0],
        n_results=top_k,
        source=file_id.strip() if file_id else None,
    )

    return build_structured_cv_context_from_matches(
        documents=result.get("documents", []),
        metadatas=result.get("metadatas", []),
    )


def _context_json(structured_cv_context: dict[str, list[str]]) -> str:
    return json.dumps(structured_cv_context, indent=2, ensure_ascii=True)


def build_job_fit_prompt(structured_cv_context: dict[str, list[str]], query: str, job_description: str | None) -> str:
    jd_text = (job_description or "").strip()
    return (
        "You are a career assistant. Evaluate candidate-job fit using CV context and job description.\n"
        f"{STYLE_GUIDANCE}"
        "Return:\n"
        "1) Verdict: Ready / Almost Ready / Not Ready\n"
        "2) Reasoning grounded in CV evidence\n"
        "3) Top 3 strengths\n"
        "4) Top 3 gaps and how to close them\n\n"
        f"User query: {query}\n\n"
        f"Job description:\n{jd_text if jd_text else 'Not provided'}\n\n"
        f"Structured CV context:\n{_context_json(structured_cv_context)}"
    )


def build_skill_gap_prompt(structured_cv_context: dict[str, list[str]], query: str, job_description: str | None) -> str:
    jd_text = (job_description or "").strip()
    return (
        "You are a career assistant. Perform skill gap analysis.\n"
        f"{STYLE_GUIDANCE}"
        "Return:\n"
        "1) Missing skills grouped by: core technical, tools/platform, and soft skills\n"
        "2) Which CV evidence already maps to required skills\n"
        "3) Priority order: high, medium, low\n"
        "4) Practical next actions for each high-priority gap\n\n"
        f"User query: {query}\n\n"
        f"Job description or benchmark profile:\n{jd_text if jd_text else 'Not provided'}\n\n"
        f"Structured CV context:\n{_context_json(structured_cv_context)}"
    )


def build_roadmap_prompt(structured_cv_context: dict[str, list[str]], query: str) -> str:
    return (
        "You are a career assistant. Build a practical 3-month roadmap to become job-ready.\n"
        f"{STYLE_GUIDANCE}"
        "Return a week-by-week plan (12 weeks) with:\n"
        "- weekly objective\n"
        "- learning resources (courses/docs/videos)\n"
        "- portfolio milestone\n"
        "- measurable outcome/checkpoint\n"
        "Tailor it to current CV strengths and gaps.\n\n"
        f"User query: {query}\n\n"
        f"Structured CV context:\n{_context_json(structured_cv_context)}"
    )


def build_cover_letter_prompt(structured_cv_context: dict[str, list[str]], query: str, job_description: str | None) -> str:
    jd_text = (job_description or "").strip()
    return (
        "You are a career assistant. Draft a personalized cover letter.\n"
        f"{STYLE_GUIDANCE}"
        "Requirements:\n"
        "- Use concrete candidate experience from the CV context\n"
        "- Align to the job description\n"
        "- Keep tone professional, concise, and specific\n"
        "- Keep it around 250-350 words\n\n"
        f"User query: {query}\n\n"
        f"Job description:\n{jd_text if jd_text else 'Not provided'}\n\n"
        f"Structured CV context:\n{_context_json(structured_cv_context)}"
    )


def build_general_prompt(structured_cv_context: dict[str, list[str]], query: str, job_description: str | None) -> str:
    jd_text = (job_description or "").strip()
    return (
        "You are a career assistant. Answer with concise, evidence-based guidance grounded in the structured CV context.\n"
        f"{STYLE_GUIDANCE}"
        "If information is missing, state assumptions explicitly.\n\n"
        f"User query: {query}\n\n"
        f"Job description context:\n{jd_text if jd_text else 'Not provided'}\n\n"
        f"Structured CV context:\n{_context_json(structured_cv_context)}"
    )


def build_prompt(
    intent: str,
    query: str,
    structured_cv_context: dict[str, list[str]],
    job_description: str | None,
) -> str:
    if intent == INTENT_JOB_FIT:
        return build_job_fit_prompt(structured_cv_context, query, job_description)
    if intent == INTENT_SKILL_GAP:
        return build_skill_gap_prompt(structured_cv_context, query, job_description)
    if intent == INTENT_ROADMAP:
        return build_roadmap_prompt(structured_cv_context, query)
    if intent == INTENT_COVER_LETTER:
        return build_cover_letter_prompt(structured_cv_context, query, job_description)
    return build_general_prompt(structured_cv_context, query, job_description)


def generate_response(prompt: str) -> str:
    return generate_text(prompt, model="gemini-3.5-flash")


def run_assistant_query(
    query: str,
    job_description: str | None = None,
    file_id: str | None = None,
    top_k: int = 8,
    history: list[dict[str, str]] = None,
) -> tuple[str, str, dict[str, list[str]]]:
    intent = detect_intent(query)
    structured_cv_context = retrieve_structured_cv_context(query, file_id=file_id, top_k=top_k)
    
    # Format history for the prompt
    history_text = ""
    if history:
        history_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history])
    
    # We modify the prompt to include history
    prompt = build_prompt(intent, query, structured_cv_context, job_description)
    if history_text:
        prompt = f"Conversation History:\n{history_text}\n\n{prompt}"
        
    answer = generate_response(prompt)
    return intent, answer, structured_cv_context
