# Architecture — Decentra

## 1. System Overview

```
USER ? Next.js (App Router) ? FastAPI REST ? [Data Layer | Analytics Layer | AI Layer] ? Decision Engine ? UI
```

Modular monolith. Single deployable API, single web app. Horizontal scaling path: background workers ? cache ? object storage ? queue ? AI gateway.

Separation of concerns: auth, ingestion, processing, analytics, ml, ai, recommendations, persistence, UI — no giant files.

## 2. Repository Structure

```
decentra/
  apps/web/        Next.js frontend
  apps/api/        FastAPI backend
  packages/shared/ constants & utils
  packages/types/  generated API types
  docs/
  scripts/
  docker/
```

Backend `apps/api/app/`:
`main.py, config/, api/, auth/, database/, models/, schemas/, services/, analytics/, ml/, ai/, insights/, recommendations/, utils/`

Frontend `apps/web/`:
`app/, components/ui, features/, hooks/, lib/, services/, types/, utils/`

## 3. Database (PostgreSQL)

Entities: users, organizations, organization_members, datasets, dataset_columns, data_quality_reports, metrics, insights, anomalies, predictions, recommendations, conversations, messages, audit_logs, analysis_jobs.

- UUIDs (TEXT in SQLite compat, UUID native in Postgres)
- created_at/updated_at, FKs, indexes on org_id/dataset_id/conversation_id
- Multi-tenancy: every dataset query filtered by organization membership (enforced in service + dependency layer). RLS documented as future option.
- Dataset rows stored as Parquet artifact on disk (`STORAGE_PATH`), not as dynamic tables — columnar scans via pandas/DuckDB, metadata in Postgres. Rationale: avoids DDL explosion, scales to millions of rows.
- ER: users 1—N organization_members N—1 organizations 1—N datasets 1—N (columns, quality_reports, metrics, insights, anomalies, predictions, recommendations). conversations 1—N messages. audit_logs per org.

## 4. API Architecture

Base `/api/v1`. Versioned router modules:

`/auth/*`, `/organizations/*`, `/datasets/*`, `/datasets/{id}/quality|kpis|analytics/*|insights|anomalies|predictions|recommendations`, `/assistant/*`, `/conversations/*`

Conventions: JSON envelope, pagination (`limit`, `offset`), Pydantic validation, consistent error shape `{detail, code}`.

## 5. Frontend Routes

`/login, /register, /onboarding, /overview, /datasets, /datasets/[id], /analytics, /insights, /anomalies, /predictions, /recommendations, /assistant, /reports, /settings`

State: TanStack Query for server state, Zustand light client state, context for auth/org. Recharts for viz, TanStack Table for data grids.

## 6. AI Pipeline (Evidence-First)

```
USER QUESTION ? INTENT ANALYSIS ? DATASET CONTEXT ? ANALYTICAL QUERY (whitelisted ops) ? COMPUTATION ? EVIDENCE ? LLM INTERPRETATION ? STRUCTURED ANSWER
```

- Intent: rule-based classifier + LLM fallback
- Query planner emits `AnalyticalQuery` (groupBy, filters, agg) executed by safe engine — LLM never generates SQL
- Evidence assembly, then LLM interprets with Pydantic-validated JSON `{answer, insights, evidence, recommendations, confidence}`
- Provider abstraction: `AIProvider` ? `OpenAIProvider` / `LocalProvider` (deterministic templates when no key)

## 7. Data Pipeline

```
UPLOAD ? FILE VALIDATION (ext, MIME sniff, size) ? SCHEMA DETECTION ? TYPE INFERENCE ? MISSING/DUPLICATE/INVALID/OUTLIER PROFILING ? QUALITY SCORE ? PARQUET STORAGE
```

Score: `0.4*completeness + 0.25*validity + 0.2*uniqueness + 0.15*consistency` (transparent, inspectable). Never silently mutate user data; record transforms.

## 8. Security

Auth: JWT access (15m) + rotating refresh (httpOnly), bcrypt/argon2. RBAC ADMIN/ANALYST/MANAGER/VIEWER, org isolation on every dataset route. Input validation (Pydantic), file validation, parameterized queries (SQLAlchemy), CORS allowlist, security headers, rate limiting (slowapi), audit logs, error sanitization. AI: prompt injection guards (data as untrusted content, delimiters, no tool exec, output schema validation, row limits, per-user rate limits, only aggregates sent to LLM).

## 9. Testing Strategy

- Unit: analytics, quality, KPI, ML utils (pytest, deterministic fixtures)
- Integration: API + DB + auth (httpx AsyncClient, ephemeral DB)
- E2E: Playwright `login ? upload ? analyze ? ask ? evidence`
- AI evaluation: groundedness/relevance/evidence-correctness harness on LocalProvider + optional live provider eval

## 10. Phases

0 Architecture (this doc) ? 1 Foundation ? 2 Data ? 3 Analytics ? 4 Intelligence ? 5 AI ? 6 Decision Support ? 7 Production

## 11. Dependencies

Backend: fastapi, uvicorn, pydantic, sqlalchemy[asyncio], asyncpg, aiosqlite, alembic, pandas, numpy, scikit-learn, scipy, openpyxl, python-jose, passlib[bcrypt], python-multipart, slowapi

Frontend: next, react, typescript, tailwind, recharts, @tanstack/react-query, @tanstack/react-table, zustand, zod

## 12. Risks & Tradeoffs

- Pandas memory ceiling ? chunked/polars later
- In-process background tasks ? queue (arq/celery) when scaling
- LLM cost/latency ? cache + local provider
- NL ambiguity ? clarification flow
- Parquet vs dynamic tables ? parquet trades SQL joins for scan performance & simplicity (justified for analytics workload)

## Scaling Roadmap

Modular monolith ? background workers ? caching ? object storage ? message queue ? independent analytics workers ? AI gateway ? horizontal scaling
