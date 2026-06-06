import json
import re
import os
from typing import Any

from groq import Groq

from app.services.cv_chunker import clean_section, detect_sections, infer_section_from_text, normalize_section_name

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
    "1. Return VALID JSON only. No conversational text, no markdown fences.\n"
    "2. For 'education', 'experience', and 'projects', ALWAYS use an array of strings. ONE ARRAY ITEM = ONE COMPLETE JOB/DEGREE/PROJECT including ALL its bullet points. Do NOT split bullet points into separate items. Each item should contain the full description of that entry.\n"
    "3. For 'skills', break them into logical groups (e.g., ['Languages: Python, Java', 'Frameworks: React, Next.js', 'Tools: Docker, Git']). Each group is one array item.\n"
    "4. Keep the header block separate: put the person's name in 'name', email/phone/location/website in 'contact', and the profile paragraph in 'summary'.\n"
    "5. Ensure no information is lost.\n"
    "6. IMPORTANT: Each project must be its own complete string in the projects array — include the project name, tech stack, and ALL bullet points in a single string. Do NOT split one project across multiple array items.\n"
    "7. Similarly for experience: each job role (including ALL its bullet points) must be ONE string in the experience array.\n"
    "\n"
    "Text:\n"
    "\"\"\"\n"
    "{raw_text}\n"
    "\"\"\""
)


def _get_groq_client() -> Groq:
    return Groq(api_key=os.getenv("GROQ_API_KEY"))


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


def _normalize_structured_resume(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        return {}

    structured: dict[str, Any] = {}
    for key, value in data.items():
        section = normalize_section_name(key)
        if isinstance(value, list):
            # Keep as list — each item becomes its own chunk
            items = [_flatten_value(item) for item in value if item]
            items = [i for i in items if i.strip()]
            if items:
                structured[section] = items
        else:
            section_text = _flatten_value(value)
            if section_text:
                structured[section] = section_text
    return structured


def _fallback_structured_resume(raw_text: str) -> dict[str, Any]:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if not lines:
        return {}

    detected = detect_sections(lines)
    structured: dict[str, Any] = {}
    for section, section_lines in detected.items():
        section_text = clean_section(section_lines)
        if section_text:
            structured[normalize_section_name(section)] = section_text

    if structured:
        return structured

    fallback_section = infer_section_from_text(raw_text, fallback="general")
    return {fallback_section: clean_section(lines)}


def structure_resume_text(raw_text: str) -> dict[str, Any]:
    prompt = STRUCTURE_PROMPT.format(raw_text=raw_text.strip())

    try:
        client = _get_groq_client()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0,
        )
        raw = response.choices[0].message.content.strip()
        parsed = json.loads(_strip_json_fences(raw))
        structured = _normalize_structured_resume(parsed)
        if structured:
            print(f"DEBUG structurer: Groq 70b path, keys={list(structured.keys())}, projects={len(structured.get('projects', [])) if isinstance(structured.get('projects'), list) else 'str'} items")
            return structured
    except Exception as e:
        print(f"DEBUG structurer: Groq 70b failed: {e}, using fallback")

    return _fallback_structured_resume(raw_text)