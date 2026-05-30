import unittest

from app.services.assistant import (
    INTENT_COVER_LETTER,
    INTENT_GENERAL,
    INTENT_JOB_FIT,
    INTENT_ROADMAP,
    INTENT_SKILL_GAP,
    build_prompt,
    build_structured_cv_context_from_matches,
    detect_intent,
)


class AssistantServiceTests(unittest.TestCase):
    def test_detect_intent_job_fit(self):
        intent = detect_intent("Am I ready for this data engineer role?")
        self.assertEqual(intent, INTENT_JOB_FIT)

    def test_detect_intent_skill_gap(self):
        intent = detect_intent("What skills am I missing for a Google internship?")
        self.assertEqual(intent, INTENT_SKILL_GAP)

    def test_detect_intent_roadmap(self):
        intent = detect_intent("Build me a 3-month roadmap to become job-ready")
        self.assertEqual(intent, INTENT_ROADMAP)

    def test_detect_intent_cover_letter(self):
        intent = detect_intent("Draft a cover letter for this job posting")
        self.assertEqual(intent, INTENT_COVER_LETTER)

    def test_detect_intent_general(self):
        intent = detect_intent("How should I improve my profile summary?")
        self.assertEqual(intent, INTENT_GENERAL)

    def test_build_structured_cv_context_from_matches(self):
        documents = [
            "Built ETL pipelines on AWS and Spark.",
            "Python, SQL, Airflow, Docker",
            "B.Tech in Computer Science",
            "Python, SQL, Airflow, Docker",
        ]
        metadatas = [
            {"section": "experience"},
            {"section": "skills"},
            {"section": "education"},
            {"section": "skills"},
        ]

        context = build_structured_cv_context_from_matches(documents, metadatas)

        self.assertEqual(context["experience"], ["Built ETL pipelines on AWS and Spark."])
        self.assertEqual(context["skills"], ["Python, SQL, Airflow, Docker"])
        self.assertEqual(context["education"], ["B.Tech in Computer Science"])

    def test_build_prompt_includes_structured_context(self):
        context = {
            "experience": ["Built ETL pipelines"],
            "skills": ["Python", "SQL"],
            "education": ["B.Tech"],
        }

        prompt = build_prompt(
            intent=INTENT_JOB_FIT,
            query="Am I ready for this data engineer role?",
            structured_cv_context=context,
            job_description="Need Spark, Airflow, and SQL",
        )

        self.assertIn("Structured CV context", prompt)
        self.assertIn("experience", prompt)
        self.assertIn("Need Spark, Airflow, and SQL", prompt)


if __name__ == "__main__":
    unittest.main()
