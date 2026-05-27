import re
from typing import Iterable

SECTION_HEADERS = {
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
    ("certifications", "licenses and certifications"),
    ("certifications", "certifications"),
    ("certifications", "certificates"),
]


def _normalize_section_name(line: str) -> str | None:
    normalized = re.sub(r"[^a-z ]", "", line.lower()).strip()
    for canonical, aliases in SECTION_HEADERS.items():
        if normalized == canonical or normalized in aliases:
            return canonical
    return None


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
    matches: list[tuple[int, int, str]] = []
    for section, marker in SECTION_MARKERS:
        pattern = re.compile(rf"(?i)\b{re.escape(marker)}\b")
        for match in pattern.finditer(text):
            matches.append((match.start(), match.end(), section))

    if not matches:
        return []

    matches.sort(key=lambda item: (item[0], -(item[1] - item[0])))
    selected: list[tuple[int, int, str]] = []
    last_end = -1
    for start, end, section in matches:
        if start >= last_end:
            selected.append((start, end, section))
            last_end = end

    if not selected:
        return []

    segments: list[dict[str, str]] = []
    prefix = text[: selected[0][0]].strip()
    if prefix:
        segments.append({"section": infer_section_from_text(prefix), "text": prefix})

    for index, (_, marker_end, section) in enumerate(selected):
        next_start = selected[index + 1][0] if index + 1 < len(selected) else len(text)
        segment_text = text[marker_end:next_start].strip()
        if segment_text:
            segments.append({"section": section, "text": segment_text})

    return segments


def extract_sections_by_lines(text: str) -> list[dict[str, str]]:
    lines = [line.strip() for line in text.splitlines()]
    segments: list[dict[str, str]] = []

    current_section = "general"
    current_lines: list[str] = []

    def flush_current() -> None:
        nonlocal current_lines, current_section
        if current_lines:
            segment_text = "\n".join(current_lines).strip()
            if segment_text:
                segments.append({"section": current_section, "text": segment_text})
        current_lines = []

    for line in lines:
        if not line:
            continue

        inferred = infer_section_from_text(line, fallback=current_section)
        if inferred != current_section and current_lines:
            flush_current()
            current_section = inferred
        elif current_section == "general":
            inferred = infer_section_from_text(line)
            if inferred != current_section and current_lines:
                flush_current()
                current_section = inferred

        current_lines.append(line)

    flush_current()

    canonical_sections = {"experience", "education", "skills", "projects", "summary", "certifications"}
    if len({segment["section"] for segment in segments if segment["section"] in canonical_sections}) < 2:
        return []

    return segments


def _chunk_text(text: str, max_chars: int = 1000, overlap: int = 100) -> Iterable[str]:
    if len(text) <= max_chars:
        yield text
        return

    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        yield text[start:end]
        if end == len(text):
            break
        start = max(end - overlap, 0)


def chunk_sections(text: str) -> list[dict[str, str]]:
    lines = [line.strip() for line in text.splitlines()]
    sections: list[dict[str, str]] = []

    current_section = "general"
    current_lines: list[str] = []

    for line in lines:
        if not line:
            continue
        header = _normalize_section_name(line)
        if header:
            if current_lines:
                sections.append(
                    {"section": current_section, "text": "\n".join(current_lines)}
                )
            current_section = header
            current_lines = []
            continue
        current_lines.append(line)

    if current_lines:
        sections.append({"section": current_section, "text": "\n".join(current_lines)})

    chunks: list[dict[str, str]] = []
    for section in sections:
        line_segments = extract_sections_by_lines(section["text"])
        if line_segments:
            for segment in line_segments:
                for chunk in _chunk_text(segment["text"]):
                    if chunk.strip():
                        chunks.append(
                            {
                                "section": infer_section_from_text(
                                    chunk.strip(), segment["section"]
                                ),
                                "text": chunk.strip(),
                            }
                        )
            continue

        section_segments = extract_section_segments(section["text"])
        if section_segments:
            for segment in section_segments:
                for chunk in _chunk_text(segment["text"]):
                    if chunk.strip():
                        chunks.append(
                            {
                                "section": infer_section_from_text(
                                    chunk.strip(), segment["section"]
                                ),
                                "text": chunk.strip(),
                            }
                        )
            continue

        for chunk in _chunk_text(section["text"]):
            if chunk.strip():
                chunk_text = chunk.strip()
                inferred_section = infer_section_from_text(chunk_text, section["section"])
                chunks.append({"section": inferred_section, "text": chunk_text})

    return chunks
