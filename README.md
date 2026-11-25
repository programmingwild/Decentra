# Decentra

[![CI](https://github.com/programmingwild/Decentra/actions/workflows/ci.yml/badge.svg)](https://github.com/programmingwild/Decentra/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-15-111111?logo=nextdotjs)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?logo=fastapi)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

**Evidence-first meeting intelligence.** Decentra turns meeting transcripts and captions into a navigable graph of decisions, action items, questions and risks — each one linked back to the exact transcript evidence it came from.

> What happened? Why did it happen? What is likely to happen next? What should I investigate?

**[Live demo](https://decentra-web.onrender.com)** · [Demo walkthrough video](./demo-final.mp4) · [Architecture](./ARCHITECTURE.md) · [User guide](./docs/USER_GUIDE.md)

---

## Table of contents

- [Why Decentra](#why-decentra)
- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Demo mode & security](#demo-mode--security)
- [Documentation](#documentation)
- [License](#license)

---

## Why Decentra

Meeting notes capture *what was said*. They rarely capture *what was decided*, *who owns it*, or *why*. Decentra closes that gap with an evidence-first pipeline:

```
transcript / captions → extraction → decisions · actions · questions · risks
                      → knowledge graph → evidence-backed assistant answers
```

Every extracted item retains pointers to the transcript segments that produced it, so an answer is always traceable to a source recording — no black-box summaries.

## Features

- **Meeting workspace** — capture or import a meeting, inspect transcript segments, evidence, and derived intelligence in one place.
- **Decision memory** — detected/confirmed decisions with status, confidence, rationale and dependency links across meetings.
- **Action tracking** — owners, deadlines, completion state, overdue/unassigned signals, and a personal action queue.
- **Knowledge Graph** — a navigable view connecting meetings → decisions → actions → risks → topics, with links back to source records.
- **Evidence-backed assistant** — streaming answers that cite the computed evidence used to produce them.
- **Analytics & ROI** — org health score, decision/action metrics, meeting ROI, timelines and review queues.
- **Browser capture** — a Chrome MV3 extension streams Google Meet captions into the same pipeline ([extension guide](./apps/extension/README.md)).
- **Immersive UI** — a responsive, animated Next.js App Router interface with a same-origin API proxy and resilient retry behavior.

## How it works

```
Browser ──▶ Next.js web app ──▶ runtime proxy (/api/v1/*) ──▶ FastAPI ──▶ Postgres / SQLite
                │                                                │
                └── React 19 · Tailwind · Framer Motion           └── extraction · analytics · AI
```

- The web app talks **only to its own origin**; `app/api/v1/[...path]/route.ts` forwards requests to `API_INTERNAL_URL` at request time. Cookies stay first-party and the API origin can change without rebuilding.
- The API is a modular monolith (auth, organizations, meetings, analytics, AI, insights) with a pluggable AI provider: **Groq** (OpenAI-compatible), OpenAI, or a deterministic local fallback.
- Provider keys stay in environment variables; the LLM never generates SQL, and answers are assembled from computed evidence before interpretation.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, Three.js / React Three Fiber, Recharts, TanStack Query, Zustand |
| Backend | FastAPI, Pydantic v2, SQLAlchemy 2 (async), Alembic, slowapi, Pandas / NumPy / scikit-learn |
| Data | PostgreSQL 16 (production), SQLite (local fallback), Redis for shared rate limits |
| AI | Groq (`openai/gpt-oss-120b`) via OpenAI-compatible client, with local deterministic fallback |
| Infra | Docker Compose, Render blueprint, GitHub Actions CI |

## Repository layout

```
apps/
  api/              FastAPI service (auth, meetings, intelligence, AI, analytics)
  web/              Next.js App Router frontend
  extension/        Chrome MV3 Google Meet caption capture
packages/           Shared constants and types
docs/               Deployment, user guide, architecture notes
samples/            Example transcript (JSON) and dataset (CSV)
scripts/            Smoke tests, demo data generation, utilities
render.yaml         Render deployment blueprint
docker-compose*.yml Local and production-style stacks
```

## Quick start

### Option A — local processes (fastest)

Requirements: Python 3.12+, Node 24+, npm.

```bash
cp .env.example .env

# Backend — http://localhost:8000 (interactive docs at /docs)
cd apps/api
pip install -r requirements.txt -r requirements-test.txt
python seed_demo.py                 # optional: demo workspace, meeting and decisions
uvicorn app.main:app --reload --port 8000

# Frontend — http://localhost:3000
cd ../web
npm ci
npm run dev
```

The web proxy uses `API_INTERNAL_URL` (default `http://localhost:8000`), so no CORS or public API URL is needed.

### Option B — full stack with Docker

Set `DATABASE_URL=postgresql+asyncpg://decentra:decentra@db:5432/decentra` and a strong `POSTGRES_PASSWORD` / `SECRET_KEY` in `.env`, then:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Web: `http://localhost:3000` · API: `http://localhost:8000/docs`. The production overlay adds Postgres health gating, Redis-backed rate limits, health checks and restart policies.

**Demo sign-in:** the login screen is prefilled with `demo@decentra.ai` / `demo1234`. In the public demo, clicking *Enter workspace* goes straight to the dashboard — see [Demo mode & security](#demo-mode--security).

## Configuration

Copy [.env.example](./.env.example) to `.env`. Key variables:

| Variable | Purpose |
| --- | --- |
| `APP_ENV` | `development` or `production` (production refuses the default secret) |
| `DATABASE_URL` | Async SQLAlchemy URL (`sqlite+aiosqlite:///...` or `postgresql+asyncpg://...`) |
| `SECRET_KEY` | JWT signing key — generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `AI_PROVIDER` | `groq`, `openai`, or `local` |
| `GROQ_API_KEY` / `GROQ_MODEL` | Groq credentials and model (default `openai/gpt-oss-120b`) |
| `API_INTERNAL_URL` | API origin used by the Next.js runtime proxy |
| `NEXT_PUBLIC_API_URL` | Leave empty for same-origin mode; set only to bypass the proxy |
| `CORS_ORIGINS` | Comma-separated browser origins allowed by the API |
| `STORAGE_PATH` | Directory for uploaded artifacts |
| `RATE_LIMIT_STORAGE_URI` | Empty for in-memory limits; `redis://redis:6379` for shared limits |
| `SENTRY_DSN` | Optional error tracking (disabled when unset) |

Secrets are never committed. `.env` is gitignored; all CI/deploy secrets are configured in the hosting environment.

## Testing

```bash
# API — 54 tests (pytest)
cd apps/api && python -m pytest tests/ -q

# Web — static check and production build
cd apps/web && npm run typecheck && npm run build

# Unit tests (Vitest)
cd apps/web && npm test

# End-to-end smoke test against a running stack
powershell -ExecutionPolicy Bypass -File scripts/smoke.ps1
```

GitHub Actions runs the API test suite and the web typecheck/build on every push and pull request.

> After a production build, use `npm run dev:fresh` to clear stale `.next` output before starting the dev server again.

## Deployment

The hosted demo uses the included [Render blueprint](./render.yaml): two Docker web services (API + web), a managed Postgres database, and runtime environment variables. The web service uses the same-origin proxy, so only the web URL is public.

**Database choice:** Neon free Postgres is recommended — it auto-suspends after ~5 min idle but resumes automatically on the next connection. Supabase free projects pause after ~7 days idle and need a manual restore from the dashboard. Swapping providers needs no code change: set `DATABASE_URL` to `postgresql+asyncpg://…?sslmode=require` in Render and run `python seed_demo.py` once in the API shell. The API creates tables on startup.

See [docs/DEPLOY.md](./docs/DEPLOY.md) and [docs/RENDER_DEPLOY.md](./docs/RENDER_DEPLOY.md) for the full walkthrough, including secrets, seeding and checklists.

Both services are on Render's free tier, which **sleeps after a period of inactivity**. The web app pings `/api/v1/health` in the background on page load and every four minutes so the API is warm when you sign in; the first page load after a long idle period may still take a few seconds.

## Demo mode & security

The public deployment is intentionally a **demo**: authentication is bypassed so the login screen is purely visual. Clicking *Enter workspace* navigates directly to the dashboard, and the web client sends a trusted `X-Decentra-Demo: 1` header that the API resolves to the seeded demo user. Rate limits are relaxed for presentation use.

**Do not use this configuration with real data.** To restore normal authentication, remove the `DEMO` flag in `apps/web/lib/api.ts`, remove the header bypass in `apps/api/app/auth/security.py`, and configure JWT access/refresh tokens plus registration as intended. The normal auth path (httpOnly rotating refresh cookies, bcrypt hashing, org-scoped RBAC, audit logging, rate limits) remains in the codebase.

## Documentation

- [Architecture](./ARCHITECTURE.md) — system design, data model, AI pipeline, tradeoffs
- [Deployment guide](./docs/DEPLOY.md) · [Render notes](./docs/RENDER_DEPLOY.md)
- [User guide](./docs/USER_GUIDE.md) · [Extension guide](./apps/extension/README.md) · [Feature test plan](./docs/Decentra_Feature_Test_Plan.pdf)
- Interactive API reference: `/docs` on a running API (Swagger UI)

## License

MIT.
