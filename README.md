# RAG Knowledge Base

Upload a PDF, it gets chunked and embedded into Postgres (pgvector), and you can chat with it.

## Stack
- Backend: FastAPI + SQLAlchemy + pgvector + OpenAI
- Frontend: React + Vite
- Vector store: Postgres with the `pgvector` extension

## Setup

1. Postgres: this project uses a local Homebrew Postgres 16 install with `pgvector` built from source (no Docker on this machine). Already set up:
   - `brew services start postgresql@16` (already running)
   - role/db: `rag` / `rag` (password `rag`)
   - `vector` extension enabled and schema applied (see `backend/init.sql`)

   To redo this from scratch, or on a machine with Docker instead, `docker-compose.yml` + `backend/init.sql` will set up an equivalent Postgres+pgvector instance via `docker compose up -d`.

2. Backend:
   ```
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env   # add your OPENAI_API_KEY
   uvicorn app.main:app --reload
   ```

3. Frontend:
   ```
   cd frontend
   npm install
   cp .env.example .env
   npm run dev
   ```

4. Open http://localhost:5173, upload a PDF, wait for status "ready", then ask questions.

## Notes
- PDF processing (extract → chunk → embed) happens synchronously in the upload request — fine for demo-sized PDFs. For larger scale, move it to a background task/queue.
- Retrieval uses pgvector cosine distance (`<=>`) over the top-K most relevant chunks per question.
