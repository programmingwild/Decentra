# Decentra � AI-Assisted Decision Intelligence Platform

> **What happened? ? Why did it happen? ? What is likely to happen next? ? What should I investigate?**

Decentra is a portfolio-grade Decision Intelligence Platform that grounds every AI answer in real analytical evidence.

```
DATA ? DATA QUALITY ? ANALYTICS ? ANOMALIES ? PREDICTIONS ? EVIDENCE ? AI INTERPRETATION ? DECISION SUPPORT
```

## Quick Start

```bash
# 1. Clone & env
cp .env.example .env

# 2. Backend (Python 3.12)
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Frontend (Node 24)
cd ../web
npm install
npm run dev
```

Open http://localhost:3000 � API at http://localhost:8000/docs

With Docker (requires Postgres):

```bash
docker compose up --build
```

## Verify & ship

```bash
# Typecheck + production build (web)
cd apps/web && npm run typecheck && npm run build

# Smoke test the running stack (API :8000, web :3000)
powershell -ExecutionPolicy Bypass -File ../scripts/smoke.ps1

# Fresh dev server (clears .next — required after a production build,
# since stale build output corrupts `next dev`)
npm run dev:fresh
```

`docker compose up --build` serves API on `:8000` and web on `:3000`
(set `NEXT_PUBLIC_API_URL` to point the web build at a remote API).

## Deploy to cloud

See [docs/DEPLOY.md](./docs/DEPLOY.md) — Railway walkthrough (~15 min, no
custom domain needed), single demo user seed (`python seed_demo.py`),
and the interview-day checklist.

## Demo Flow (2 minutes)

1. Register ? Create organization
2. Upload `samples/sales_demo.csv`
3. View Data Quality Report (score + breakdown)
4. Explore auto-generated KPIs + trend chart
5. Check Anomalies tab (z-score / IQR explanation)
6. View Predictions (forecast with uncertainty)
7. Automated Insights appear
8. Ask: "Why did revenue decline?" ? evidence-backed answer
9. Click View Evidence ? see underlying computation
10. Ask: "What should I investigate first?" ? ranked recommendation

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) and [docs/](./docs/)

## Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind + Recharts + TanStack Query
- **Backend:** FastAPI + Pydantic v2 + SQLAlchemy 2 (async) + Pandas/NumPy/scikit-learn
- **DB:** PostgreSQL (SQLite for local dev without Docker)
- **AI:** Pluggable `AIProvider` (OpenAI / Local deterministic fallback)

## Project Structure

```
apps/api  ? FastAPI backend (modular: auth, analytics, ml, ai, insights)
apps/web  ? Next.js frontend
apps/extension ? Chrome MV3 Meet caption capture → same pipeline
packages/shared, packages/types
docs/     ? ARCHITECTURE.md, DATABASE.md, API.md, AI.md, SECURITY.md
```

## Security

- JWT access (15m) + rotating refresh (httpOnly cookie), argon2/bcrypt hashing
- RBAC: ADMIN / ANALYST / MANAGER / VIEWER, org-scoped isolation
- File validation, parameterized queries, CORS, rate limiting, audit logs
- AI: no free-form SQL from LLM, evidence computed before interpretation

## License

MIT
