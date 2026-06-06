import os
import re
import json
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from groq import Groq
from google import genai as google_genai

from app.services.embeddings import embed_texts
from app.services.vector_store import query_embeddings, get_embeddings_by_source

router = APIRouter(prefix="/jobs", tags=["jobs"])

JSEARCH_API_KEY = os.getenv("JSEARCH_API_KEY")
JSEARCH_URL = "https://api.openwebninja.com/jsearch/search-v2"

# In-memory cache for job feed
_feed_cache: dict[str, list[dict]] = {}

# Two separate clients — Gemini for scoring, Groq for feed
_gemini_client = None
_groq_client = None


def _get_gemini_client() -> google_genai.Client:
    global _gemini_client
    if _gemini_client is None:
        key = os.getenv("GEMINI_API_KEY_JOBS")
        print(f"INIT gemini client with key: {key[:12] if key else 'NONE'}")
        _gemini_client = google_genai.Client(api_key=key)
    return _gemini_client


def _get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        key = os.getenv("GROQ_API_KEY")
        print(f"INIT groq client with key: {key[:12] if key else 'NONE'}")
        _groq_client = Groq(api_key=key)
    return _groq_client


def _extract_json(raw: str) -> dict:
    clean = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.IGNORECASE)
    match = re.search(r"\{.*\}", clean, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(clean)


def _generate_analysis(cv_context: str, title: str, company: str, description: str) -> dict:
    """Uses Gemini 3.5 Flash for fit scoring and skill gap detection."""
    prompt = f"""You are a strict career advisor scoring a CV against a specific job.

JOB: {title} at {company}
JOB DESCRIPTION:
{description[:800]}

CANDIDATE CV:
{cv_context[:1500]}

Your task:
1. Read the job description carefully for specific requirements
2. Compare EACH requirement against the CV
3. Give a score that reflects the actual % of requirements met

Important context:
- This is a UNIQUE job with specific requirements — score it differently from similar jobs
- Internship + projects counts as 0-2 years experience
- Published EMNLP research paper is strong evidence for NLP roles
- Stanford ML cert counts as ML knowledge
- Focus on what THIS job specifically needs vs similar jobs

Score strictly based on THIS job's specific requirements:
- 85+: CV meets nearly all specific requirements of this exact job
- 70-84: CV meets most requirements, 1 minor specific gap
- 55-69: CV meets core skills but missing 1-2 job-specific requirements
- 40-54: Partial match, missing several specific requirements
- <40: Poor match for this specific role

Return ONLY this JSON, no markdown:
{{"fit_score": <integer, NOT a decimal, vary it based on the specific job>, "fit_reason": "<name specific skills from CV that match THIS job's requirements, and the main specific gap>", "missing_skills": ["<only skills explicitly in the job description that are absent from CV, max 3, empty [] if score 85+>"]}}"""

    response = _get_gemini_client().models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt,
    )
    raw = (getattr(response, "text", "") or "").strip()
    result = _extract_json(raw)

    if not isinstance(result.get("missing_skills"), list):
        result["missing_skills"] = []
    result["missing_skills"] = [
        s for s in result["missing_skills"]
        if isinstance(s, str) and len(s) < 40
    ][:3]

    return result


def _generate_feed_roles(cv_context: str) -> list[dict]:
    """Uses Groq llama-3.1-8b-instant for feed role recommendations."""
    prompt = f"""You are a career advisor. Based on this CV, suggest the 3 best-fit job roles for this candidate.

CV:
{cv_context[:2000]}

Return ONLY a JSON array with exactly 3 objects. Each object has:
- "title": the exact job title as it appears on job boards (e.g. "Senior Graphic Designer", "UX Designer", "Data Analyst") — use industry-standard titles, not paraphrases
- "reason": one sentence why this role fits the CV
- "match_score": integer 0-100 based on how well the CV matches this role type

Example:
[
  {{"title": "NLP Engineer", "reason": "Published NLP research and Python/ML experience align strongly.", "match_score": 88}},
  {{"title": "ML Engineer", "reason": "Stanford ML cert and scikit-learn experience are directly relevant.", "match_score": 82}},
  {{"title": "Backend Developer", "reason": "FastAPI and PostgreSQL experience cover core backend requirements.", "match_score": 71}}
]

Return ONLY the JSON array, no markdown."""

    response = _get_groq_client().chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
        temperature=0.4,
    )
    raw = response.choices[0].message.content.strip()
    clean = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.IGNORECASE)
    match = re.search(r'\[.*\]', clean, re.DOTALL)
    roles = json.loads(match.group() if match else clean)
    if not isinstance(roles, list):
        raise ValueError("Not a list")
    return roles[:3]


# ── Pydantic models ────────────────────────────────────────────────────────────

class JobSearchRequest(BaseModel):
    query: str
    file_id: str


class JobCard(BaseModel):
    job_id: str
    title: str
    company: str
    location: str
    salary_range: str | None
    deadline: str | None
    redirect_url: str
    fit_score: float
    fit_reason: str
    missing_skills: list[str]
    employment_type: str | None
    posted_at: str | None
    is_remote: bool


class SaveJobRequest(BaseModel):
    job_id: str
    title: str
    company: str
    redirect_url: str
    fit_score: float
    user_id: str


# ── Swagger test endpoints ─────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"status": "ok", "router": "job_hunter"}


@router.get("/test-raw")
async def test_raw_jobs(query: str = "software engineer Dhaka"):
    jobs = await _fetch_jsearch(query)
    return {
        "count": len(jobs),
        "sample": [
            {
                "title": j.get("job_title"),
                "company": j.get("employer_name"),
                "location": f"{j.get('job_city') or ''} {j.get('job_country') or ''}".strip(),
            }
            for j in jobs[:5]
        ],
    }


@router.get("/test-cv-context")
async def test_cv_context(file_id: str, query: str = "programming experience"):
    context = await _get_full_cv(file_id)
    if context == "No CV context available.":
        return {
            "status": "empty",
            "message": "No embeddings found. Run POST /cv/ingest first.",
            "file_id": file_id,
        }
    return {
        "status": "ok",
        "file_id": file_id,
        "preview": context[:400] + "..." if len(context) > 400 else context,
    }


@router.get("/test-scorer")
async def test_scorer():
    dummy_cv = """Python developer with internship at RedDot Digital (FastAPI, ML, Scikit-learn, Spacy).
Published NLP research paper at EMNLP 2023. Stanford ML Specialization certificate.
Projects: CV filtering app (Python/PyTorch/Spacy), sentiment analysis (BanglaBERT).
Skills: Python, React, Node.js, PostgreSQL, Git, Linux."""
    dummy_desc = "Junior Python Developer. Requires Python, REST APIs, basic ML knowledge. 0-2 years experience."
    try:
        analysis = _generate_analysis(dummy_cv, "Junior Python Developer", "TestCo", dummy_desc)
        return {"status": "ok", "analysis": analysis}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ── Main endpoints ─────────────────────────────────────────────────────────────

@router.post("/search", response_model=list[JobCard])
async def search_jobs(req: JobSearchRequest):
    raw_jobs = await _fetch_jsearch(req.query)
    if not raw_jobs:
        raise HTTPException(status_code=404, detail="No jobs found for this query.")

    cv_context = await _get_full_cv(req.file_id)
    return await _score_jobs(raw_jobs, cv_context)


@router.get("/feed")
async def get_job_feed(file_id: str):
    """
    Returns 3 recommended roles based on the CV using Groq 8b.
    Cached in memory — only called once per CV upload.
    """
    if not file_id:
        raise HTTPException(status_code=400, detail="file_id required")

    if file_id in _feed_cache:
        return _feed_cache[file_id]

    cv_context = await _get_full_cv(file_id)
    if cv_context == "No CV context available.":
        raise HTTPException(status_code=404, detail="CV not found. Run /cv/ingest first.")

    try:
        roles = _generate_feed_roles(cv_context)
    except Exception as e:
        print(f"Feed error: {e}")
        raise HTTPException(status_code=500, detail="Could not generate recommendations.")

    _feed_cache[file_id] = roles
    return roles


@router.post("/save")
async def save_job(req: SaveJobRequest):
    """Save a job to the Kanban application tracker."""
    from app.db import supabase

    existing = supabase.table("applications").select("id").eq(
        "user_id", req.user_id
    ).eq("role", req.title).eq("company", req.company).execute()

    if existing.data:
        raise HTTPException(status_code=400, detail="Job already saved to tracker.")

    res = supabase.table("applications").insert({
        "user_id": req.user_id,
        "company": req.company,
        "role": req.title,
        "status": "Applied",
        "notes": f"Fit score: {req.fit_score}% — {req.redirect_url}",
        "applied_date": None,
    }).execute()

    return {"status": "saved", "application_id": res.data[0]["id"]}


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _fetch_jsearch(query: str) -> list[dict]:
    q = query.lower()

    if "intern" in q and not any(kw in q for kw in ["remote", "worldwide", "global"]):
        query = query + " OR remote"
    elif not any(kw in q for kw in ["dhaka", "bangladesh", "bd", "remote"]):
        query = query + " Dhaka OR remote"

    jobs = await _jsearch_request(query)

    if not jobs:
        broad = re.sub(r"\b(bangladesh|dhaka|bd)\b", "", query, flags=re.IGNORECASE).strip()
        broad = broad + " remote"
        jobs = await _jsearch_request(broad)

    return jobs


async def _jsearch_request(query: str) -> list[dict]:
    headers = {"x-api-key": JSEARCH_API_KEY}
    params = {
        "query": query,
        "page": "1",
        "num_pages": "1",
        "employment_types": "FULLTIME,PARTTIME,INTERN,CONTRACTOR",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(JSEARCH_URL, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()
    return data.get("data", {}).get("jobs", [])


async def _get_full_cv(file_id: str) -> str:
    try:
        results = get_embeddings_by_source(file_id)
        documents = results.get("documents", [])
        if not documents:
            return "No CV context available."
        return "\n\n".join(str(doc) for doc in documents if doc)
    except Exception:
        return "No CV context available."


async def _get_cv_context(query: str, file_id: str) -> str:
    query_embedding = embed_texts([query])[0]
    results = query_embeddings(
        query_embedding=query_embedding,
        n_results=4,
        source=file_id,
    )
    documents = results.get("documents", [])
    if not documents:
        return "No CV context available."
    return "\n\n".join(str(doc) for doc in documents if doc)


async def _score_jobs(raw_jobs: list[dict], cv_context: str) -> list[JobCard]:
    results = []

    for job in raw_jobs[:5]:
        title       = job.get("job_title", "Untitled")
        company     = job.get("employer_name", "Unknown")
        location    = f"{job.get('job_city') or ''} {job.get('job_country') or ''}".strip()
        description = (job.get("job_description") or "")[:1200]
        redirect    = job.get("job_apply_link") or job.get("job_google_link") or "#"
        deadline    = job.get("job_offer_expiration_datetime_utc")

        salary_str = None
        if job.get("job_salary"):
            period = job.get("job_salary_period") or "hour"
            salary_str = f"${job['job_salary']} / {period.lower()}"
        elif job.get("job_min_salary") and job.get("job_max_salary"):
            currency = job.get("job_salary_currency") or "USD"
            period   = job.get("job_salary_period") or "year"
            salary_str = f"{currency} {int(job['job_min_salary']):,}–{int(job['job_max_salary']):,} / {period}"

        try:
            analysis = _generate_analysis(cv_context, title, company, description)
        except Exception as e:
            print(f"DEBUG scorer error: {e}")
            analysis = {"fit_score": 0, "fit_reason": "Could not compute score.", "missing_skills": []}

        results.append(JobCard(
            job_id=job.get("job_id", ""),
            title=title,
            company=company,
            location=location,
            salary_range=salary_str,
            deadline=deadline,
            redirect_url=redirect,
            fit_score=float(analysis.get("fit_score", 0)),
            fit_reason=analysis.get("fit_reason", ""),
            missing_skills=analysis.get("missing_skills", []),
            employment_type=job.get("job_employment_type"),
            posted_at=job.get("job_posted_at_datetime_utc"),
            is_remote=bool(job.get("job_is_remote", False)),
        ))

    return sorted(results, key=lambda x: x.fit_score, reverse=True)