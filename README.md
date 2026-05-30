# CareerPilot

A full-stack career guidance platform built with:

- Next.js
- Tailwind CSS
- shadcn/ui
- FastAPI
- Supabase

---

# Tech Stack

## Frontend
- Next.js
- Tailwind CSS
- shadcn/ui

## Backend
- FastAPI

## Database
- Supabase PostgreSQL

---

# Project Structure

```txt
CareerPilot/
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── ...
│
├── backend/
│   ├── app/
│   ├── requirements.txt
│   └── ...
│
└── README.md
```

---

# Frontend Setup

## 1. Navigate to frontend

```bash
cd frontend
```

## 2. Install dependencies

```bash
npm install
```

## 3. Create environment file

Create:

```txt
frontend/.env.local
```

Add:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 4. Run frontend

```bash
npm run dev
```

Frontend runs on:

```txt
http://localhost:3000
```

---

# Backend Setup

## 1. Navigate to backend

```bash
cd backend
```

## 2. Create virtual environment

### Linux/macOS

```bash
python -m venv venv
source venv/bin/activate
```

### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

## 3. Install dependencies

```bash
pip install -r requirements.txt
```

## 4. Create environment file

Create:

```txt
backend/.env
```

Add:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_role_key
SUPABASE_BUCKET=cvs
GEMINI_API_KEY=your_gemini_api_key
```

## 5. Run backend

```bash
uvicorn app.main:app --reload
```

Backend runs on:

```txt
http://127.0.0.1:8000
```

---

# Supabase Setup

Create a Supabase project from:

https://supabase.com/dashboard

Get:
- Project URL
- anon public key
- service_role key

---

# License

MIT