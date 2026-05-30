import json
import re
from typing import Any

import google.generativeai as genai

from app.core.config import get_settings
from app.services.cv_chunker import clean_section, detect_sections, infer_section_from_text, normalize_section_name

STRUCTURE_PROMPT = (
    "You are a resume parser.\n"
    "Convert the following resume text into structured JSON with sections:\n"
    "- name\n"
    "- contact\n"
    "- summary\n"
    "- education\n"
    "- experience\n"
    "- skills\n"
    "- projects\n"
    "Return valid JSON only.\n"
    "Use strings for short sections and arrays of strings for multi-line sections when helpful.\n"
    "Keep the header block separate: put the person's name in name, email/phone/location/website in contact, and the profile paragraph in summary. Do not mix any of that into experience.\n"
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
    settings = get_settings()
    genai.configure(api_key=settings.gemini_api_key)

    prompt = STRUCTURE_PROMPT.format(raw_text=raw_text.strip())
    model = genai.GenerativeModel("gemini-3.5-flash")

    try:
        response = model.generate_content(prompt)
        response_text = getattr(response, "text", "") or ""
        parsed = json.loads(_strip_json_fences(response_text))
        structured = _normalize_structured_resume(parsed)
        if structured:
            return structured
    except Exception:
        pass

    return _fallback_structured_resume(raw_text)
