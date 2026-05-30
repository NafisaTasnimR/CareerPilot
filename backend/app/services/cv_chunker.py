import re
from typing import Iterable

SECTION_HEADERS = {
    "name": {
        "name",
        "full name",
        "candidate name",
    },
    "contact": {
        "contact",
        "contact information",
        "personal details",
        "details",
    },
    "experience": {
        "experience",
        "work experience",
        "professional experience",
        "employment history",
        "career history",
        "professional background",
    },
    "education": {
        "education",
        "education and training",
        "academic background",
        "academic history",
        "qualifications",
    },
    "skills": {
        "skills",
        "technical skills",
        "core skills",
        "competencies",
        "core competencies",
        "additional skills",
    },
    "projects": {
        "projects",
        "project experience",
        "selected projects",
        "project portfolio",
    },
    "summary": {
        "summary",
        "professional summary",
        "profile",
        "about",
        "about me",
    },
    "certifications": {
        "certifications",
        "certificates",
        "licenses",
        "licenses and certifications",
    },
}

SECTION_ORDER = ["name", "contact", "summary", "experience", "education", "skills", "projects", "certifications", "general"]

SECTION_KEYWORDS = {
    "experience": {
        "experience",
        "work experience",
        "employment",
        "worked",
        "managed",
        "led",
        "developed",
        "responsible",
        "company",
        "role",
        "team",
        "client",
        "achievement",
    },
    "education": {
        "education",
        "university",
        "college",
        "school",
        "degree",
        "bachelor",
        "master",
        "diploma",
        "graduated",
        "coursework",
        "gpa",
    },
    "skills": {
        "skills",
        "proficient",
        "python",
        "java",
        "javascript",
        "typescript",
        "react",
        "node",
        "sql",
        "excel",
        "aws",
        "docker",
        "kubernetes",
        "figma",
        "photoshop",
        "tableau",
        "communication",
    },
    "projects": {
        "project",
        "projects",
        "built",
        "created",
        "deployed",
        "portfolio",
        "capstone",
        "hackathon",
    },
    "summary": {
        "summary",
        "profile",
        "objective",
        "passionate",
        "experienced",
        "driven",
    },
    "contact": {
        "contact",
        "email",
        "phone",
        "linkedin",
        "website",
        "location",
    },
    "certifications": {
        "certification",
        "certifications",
        "certificate",
        "license",
        "licensed",
        "aws certified",
        "pmp",
        "cfa",
        "csm",
    },
}

SECTION_MARKERS = [
    ("name", "full name"),
    ("name", "name"),
    ("experience", "professional experience"),
    ("experience", "work experience"),
    ("experience", "employment history"),
    ("education", "education and training"),
    ("education", "education"),
    ("skills", "additional skills"),
    ("skills", "technical skills"),
    ("skills", "skills"),
    ("projects", "project experience"),
    ("projects", "projects"),
    ("summary", "professional summary"),
    ("summary", "professional profile"),
    ("summary", "summary"),
    ("summary", "profile"),
    ("contact", "contact information"),
    ("contact", "contact"),
    ("certifications", "licenses and certifications"),
    ("certifications", "certifications"),
    ("certifications", "certificates"),
]


def normalize_section_name(section: str | None) -> str:
    normalized = re.sub(r"\s+", " ", str(section or "general")).strip().lower()
    for canonical, aliases in SECTION_HEADERS.items():
        if normalized == canonical or normalized in aliases:
            return canonical
    return "general"


def clean_section(lines: list[str]) -> str:
    return " ".join(line.strip() for line in lines if line and line.strip()).strip()


def detect_sections(lines: list[str]) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {"general": []}
    current_section = "general"

    for line in lines:
        normalized_line = re.sub(r"\s+", " ", line).strip()
        if not normalized_line:
            continue

        section_name = normalize_section_name(normalized_line)
        if _looks_like_section_heading(normalized_line) and section_name != "general":
            current_section = section_name
            sections.setdefault(current_section, [])
            continue

        sections.setdefault(current_section, []).append(normalized_line)

    return sections


def chunk_text(text: str, chunk_size: int = 300) -> list[str]:
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    for index in range(0, len(words), chunk_size):
        chunk = " ".join(words[index : index + chunk_size]).strip()
        if chunk:
            chunks.append(chunk)
    return chunks


def chunk_sections_from_sections(sections: dict[str, str | list[str]], chunk_size: int = 300) -> list[dict[str, str]]:
    chunks: list[dict[str, str]] = []

    for section, content in sections.items():
        if isinstance(content, list):
            section_text = clean_section([str(item) for item in content])
        else:
            section_text = str(content or "").strip()

        if not section_text:
            continue

        for chunk in chunk_text(section_text, chunk_size=chunk_size):
            chunks.append({"section": normalize_section_name(section), "text": chunk})

    return chunks


def _looks_like_section_heading(line: str) -> bool:
    normalized_line = re.sub(r"\s+", " ", line).strip().rstrip(":")
    if not normalized_line:
        return False

    normalized_section = normalize_section_name(normalized_line)
    if not normalized_section:
        return False

    if len(normalized_line) > 60:
        return False

    if len(normalized_line.split()) > 6:
        return False

    if normalized_line.lower() == normalized_section:
        return True

    aliases = SECTION_HEADERS.get(normalized_section, set())
    return normalized_line.lower() in aliases


def _normalize_section_name(line: str) -> str | None:
    normalized = normalize_section_name(line)
    return normalized if normalized else None


def infer_section_from_text(text: str, fallback: str = "general") -> str:
    normalized_text = re.sub(r"[^a-z0-9 ]", " ", text.lower())
    scores: dict[str, int] = {}

    for section, keywords in SECTION_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            if keyword in normalized_text:
                score += 1
        scores[section] = score

    best_section = max(scores, key=scores.get, default=fallback)
    if scores.get(best_section, 0) == 0:
        return fallback
    return best_section


def extract_section_segments(text: str) -> list[dict[str, str]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return []

    detected = detect_sections(lines)
    heading_sections = [section for section in detected if section != "general" and detected[section]]
    if not heading_sections:
        return []

    segments: list[dict[str, str]] = []
    for section, section_lines in detected.items():
        if not section_lines:
            continue
        segment_text = clean_section(section_lines)
        if segment_text:
            segments.append({"section": normalize_section_name(section), "text": segment_text})

    return segments


def extract_sections_by_lines(text: str) -> list[dict[str, str]]:
    return extract_section_segments(text)


def _append_chunk(chunks: list[dict[str, str]], section: str, text: str) -> None:
    chunk_text = text.strip()
    if chunk_text:
        chunks.append({"section": section, "text": chunk_text})


def chunk_sections_improved(text: str) -> list[dict[str, str]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return []

    segments = extract_section_segments(text)
    if segments:
        return chunk_sections_from_sections({segment["section"]: segment["text"] for segment in segments})

    cleaned_text = clean_section(lines)
    if not cleaned_text:
        return []

    section = infer_section_from_text(cleaned_text, fallback="general")
    return chunk_sections_from_sections({section: cleaned_text})


def chunk_sections(text: str) -> list[dict[str, str]]:
    return chunk_sections_improved(text)
