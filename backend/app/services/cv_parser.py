import os

import docx
import pdfplumber


def _parse_pdf(file_path: str) -> str:
    pages = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                pages.append(page_text)
    return "\n".join(pages)


def _parse_docx(file_path: str) -> str:
    document = docx.Document(file_path)
    paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def parse_file(file_path: str, filename: str) -> str:
    _, ext = os.path.splitext(filename.lower())
    if ext == ".pdf":
        return _parse_pdf(file_path)
    if ext == ".docx":
        return _parse_docx(file_path)

    raise ValueError("Only PDF and DOCX files are supported")
