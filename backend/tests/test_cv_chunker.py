import unittest

from app.services.cv_chunker import chunk_sections, chunk_sections_from_sections, detect_sections


class CvChunkerTests(unittest.TestCase):
    def test_chunk_sections_keeps_paragraph_boundaries(self):
        text = (
            "Summary\n"
            "Experienced engineer\n"
            "\n"
            "Built scalable APIs\n"
            "\n"
            "Skills\n"
            "Python\n"
            "SQL\n"
        )

        chunks = chunk_sections(text)

        self.assertEqual([chunk["section"] for chunk in chunks], ["summary", "skills"])
        self.assertEqual([chunk["text"] for chunk in chunks], ["Experienced engineer Built scalable APIs", "Python SQL"])

    def test_chunk_sections_from_structured_sections(self):
        sections = {
            "experience": "Built scalable APIs for enterprise clients",
            "skills": "Python SQL FastAPI",
        }

        chunks = chunk_sections_from_sections(sections, chunk_size=3)

        self.assertEqual([chunk["section"] for chunk in chunks], ["experience", "experience", "skills"])
        self.assertEqual(
            [chunk["text"] for chunk in chunks],
            ["Built scalable APIs", "for enterprise clients", "Python SQL FastAPI"],
        )

    def test_detect_sections_groups_lines_by_heading(self):
        sections = detect_sections(["Summary", "Experienced engineer", "Skills", "Python"])

        self.assertEqual(sections["summary"], ["Experienced engineer"])
        self.assertEqual(sections["skills"], ["Python"])


if __name__ == "__main__":
    unittest.main()