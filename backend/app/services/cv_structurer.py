import json
import re
from typing import Any

from app.services.cv_chunker import clean_section, detect_sections, infer_section_from_text, normalize_section_name
from app.services.gemini import generate_text

STRUCTURE_PROMPT = (
    "You are a professional resume parser. Your goal is to convert raw resume text into a clean, structured JSON format.\n"
    "Convert the following resume text into structured JSON with these exact sections:\n"
    "- name\n"
    "- contact\n"
    "- summary\n"
    "- education\n"
    "- experience\n"
    "- skills\n"
    "- projects\n"
    "\n"
    "CRITICAL GUIDELINES:\n"
    "1. Return VALID JSON only. No conversational text.\n"
    "2. For 'education', 'experience', 'skills', and 'projects', ALWAYS use an array of strings. Each string should be a distinct entry (e.g., one job, one degree, one skill group).\n"
    "3. For 'skills', do not just put one long string. Break them into logical groups or individual skills (e.g., ['Python, Java', 'React, Next.js', 'AWS, Docker']).\n"
    "4. Keep the header block separate: put the person's name in 'name', email/phone/location/website in 'contact', and the profile paragraph in 'summary'.\n"
    "5. Ensure no information is lost, but format it cleanly.\n"
    "\n"
    "Text:\n"
    "\"\"\"\n"
    "{raw_text}\n"
    "\"\"\""
)


def _strip_json_fences(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped, flags=re.IGNORECASE)
        if stripped.endswith("```"):
            stripped = stripped[:-3]
    stripped = stripped.strip()

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end != -1 and end > start:
        return stripped[start : end + 1]
    return stripped


def _flatten_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts = [_flatten_value(item) for item in value]
        return clean_section([part for part in parts if part])
    if isinstance(value, dict):
        parts: list[str] = []
        for key, nested_value in value.items():
            nested_text = _flatten_value(nested_value)
            if nested_text:
                parts.append(f"{key}: {nested_text}")
        return clean_section(parts)
    return str(value).strip()


def _normalize_structured_resume(data: Any) -> dict[str, str]:
    if not isinstance(data, dict):
        return {}

    structured: dict[str, str] = {}
    for key, value in data.items():
        section = normalize_section_name(key)
        section_text = _flatten_value(value)
        if section_text:
            structured[section] = section_text
    return structured


def _fallback_structured_resume(raw_text: str) -> dict[str, str]:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if not lines:
        return {}

    detected = detect_sections(lines)
    structured: dict[str, str] = {}
    for section, section_lines in detected.items():
        section_text = clean_section(section_lines)
        if section_text:
            structured[normalize_section_name(section)] = section_text

    if structured:
        return structured

    fallback_section = infer_section_from_text(raw_text, fallback="general")
    return {fallback_section: clean_section(lines)}


def structure_resume_text(raw_text: str) -> dict[str, str]:
    prompt = STRUCTURE_PROMPT.format(raw_text=raw_text.strip())

    try:
        response_text = generate_text(prompt, model="gemini-3.5-flash")
        parsed = json.loads(_strip_json_fences(response_text))
        structured = _normalize_structured_resume(parsed)
        if structured:
            return structured
    except Exception:
        pass

    return _fallback_structured_resume(raw_text)
