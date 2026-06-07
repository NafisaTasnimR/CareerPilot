# CareerPilot – AI Career Co‑pilot

**CareerPilot** is a full‑stack web application that helps job seekers optimise their job search.  
Upload your CV once, and let our AI assistant analyse your profile, find matching roles, identify skill gaps, draft cover letters, and create a personalised learning roadmap.

> Built for the **Hackathon** – fully functional, container‑ready, and deployed on modern cloud infrastructure.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [How It Works (For Judges)](#how-it-works-for-judges)
- [Prerequisites](#prerequisites)
- [Running the Project](#running-the-project)
- [User Guide ](#user-guide-with-screenshots)
---

## Features

- **Google OAuth Authentication** – Secure sign‑in with your Google account.
- **AI‑Powered CV Parsing** – Extracts experience, education, skills, and projects.
- **Vector Search** – Uses Gemini embeddings to find the most relevant CV sections.
- **Intelligent Assistant** – Answers career questions, evaluates job fit, analyses skill gaps, generates cover letters, and builds a 3‑month roadmap.
- **Job Tracker (Kanban Board)** – Drag‑and‑drop board to manage your applications (Applied → Interviewing → Offer → Rejected).
- **Progress Dashboard** – Visualises your application stats and goal completion.

---

## Tech Stack

| Layer          | Technology                                                                 |
|----------------|----------------------------------------------------------------------------|
| **Frontend**   | Next.js (App Router), Tailwind CSS, shadcn/ui components                  |
| **Backend**    | FastAPI (Python 3.12+), SQLAlchemy, Pydantic                              |
| **Database**   | Supabase (PostgreSQL with pgvector extension)                             |
| **Storage**    | Supabase Storage (for CV files)                                           |
| **AI / Embeddings** | Google Gemini API (`gemini-embedding-2`, `gemini-3.5-flash`)          |
| **Auth**       | Firebase Authentication (Google sign‑in)                                  |
| **Vector Search** | `pgvector` distance operator (`<->`) + custom RPC function            |

---

## How It Works (For Judges)

1. **User signs in** with Google → Firebase token is sent to the backend.
2. **CV upload** – PDF/DOCX file is stored in Supabase Storage.
3. **Ingestion** – Backend extracts text → splits into semantic sections → generates embeddings using Gemini → stores vector + text in `cv_embeddings` table.
4. **Assistant** – User asks a question → backend embeds the query → performs vector similarity search → retrieves relevant CV chunks → sends a structured prompt to Gemini → returns the answer.
5. **Job Tracker** – CRUD operations on Supabase tables with row‑level security (user_id = firebase_uid).
6. **All API endpoints** are protected by Firebase token verification (`get_current_user` dependency).

>  The backend uses **Supabase (PostgreSQL + pgvector)** for all data – no SQLite, no local files.

---

## Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.12 (recommended) – *avoid Python 3.13* (compatibility issues with some libraries)
- **Supabase account** – free tier is sufficient
- **Google Cloud project** with **Firebase** enabled (for authentication)
- **Gemini API key** – from [Google AI Studio](https://aistudio.google.com/)

---
# CareerPilot – User Guide

Welcome to **CareerPilot**! This guide walks you through every feature of the platform, from signing in to using the AI assistant and tracking your job applications.

> **Screenshots** – Place your actual screenshots in the `docs/` folder and replace the placeholder image paths below.

---

## 1. Landing Page

![Landing page screenshot placeholder](docs/landing.png)

- The landing page introduces the core features.
- Click **Login** or **Sign Up** in the top‑right corner to begin.
- Only **Google authentication** is available – no email/password.

---

## 2. Sign In with Google

![Google sign‑in modal](docs/auth-modal.png)

- A pop‑up will ask you to select a Google account.
- Grant basic profile access (email, name, profile picture).
- After successful sign‑in, you are redirected to the **Dashboard**.

> **Note**: The first time you sign in, your user record is automatically created in our secure database.

---

## 3. Upload Your CV

![CV upload area](docs/upload.png)

- On the Dashboard, you’ll see a file drop zone.
- Drag & drop a **PDF or DOCX** file (max 10 MB) or click to browse.
- The upload process shows three stages:
  1. **Upload resume** – file is stored securely.
  2. **Parse sections** – AI extracts experience, skills, education, projects.
  3. **Index for search** – your CV is embedded into our vector database.

- Once completed, you’ll see a success message and your parsed CV data.

---

## 4. Resume Overview

![Parsed CV sections](docs/dashboard.png)

- After indexing, the Dashboard displays a breakdown of your CV:
  - **Experience entries** – number of roles.
  - **Education entries** – degrees / qualifications.
  - **Skill tags** – automatically extracted skills.
  - **Projects** – number of projects found.

- Each section (Experience, Education, Skills, Projects) can be expanded to see full details.
- Use the **Re‑upload** button to replace your CV at any time.

---

## 5. AI Assistant

![Assistant chat interface](docs/assistant.png)

- Navigate to **Assistant** from the side menu.
- Type your question in the chat input and press **Enter** or click the **Send** button.

### Example questions you can ask:

| Category | Example |
|----------|---------|
| Job fit | “Am I ready for a Senior Data Engineer role?” |
| Skill gap | “What skills am I missing for cloud engineering?” |
| Cover letter | “Write a cover letter for a Backend Developer position at ABC Corp.” |
| Roadmap | “Give me a 3‑month learning roadmap to become job‑ready as a full‑stack developer.” |
| General | “What projects on my CV are most relevant for a machine learning role?” |

- The assistant always uses **your actual CV** to ground its answers – no generic hallucinations.
- Responses can include tables, bullet points, code blocks, and formatted text.

---

## 6. Job Tracker (Kanban Board)

![Kanban board](docs/kanban.png)

- Go to **Tracker** from the side menu.
- You’ll see four columns: **Applied**, **Interviewing**, **Offer**, **Rejected**.

### Adding an application
1. Click the **+ Add Application** button.
2. Enter the **Company name** and **Role**.
3. Click **Save**. The card appears in the **Applied** column.

### Moving a card
- **Drag and drop** the card to another column.
- Or click the small **→** buttons (e.g., “→ Interviewing”) to move the card.

### Deleting a card
- Click the **✕** button on the card to delete it.

> All changes are saved instantly to the database.

---

## 7. Progress Dashboard

![Progress stats](docs/progress.png)

- The main Dashboard (home after login) shows your current stats:
  - Total applications sent
  - Weekly applications
  - Status breakdown (Applied / Interviewing / Offer / Rejected)
  - Tasks completed / total tasks (from the calendar feature)
  - Roadmap completion percentage (goals)

- Use the **Find jobs** card to explore matching job openings (future integration).
- Use the **AI assistant** card to go back to the chat.

---

## 8. Settings

![Settings page](docs/settings.png)

- Click your profile icon or navigate to **Settings**.
- You can update your:
  - **Full name**
  - **Profile picture URL**
- Email is read‑only (cannot be changed).
- Password management is not needed because you use Google sign‑in.

> Changes are synced to both Firebase and our backend.

---

