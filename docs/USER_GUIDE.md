# Decentra — First-Time User Guide

> **What happened? · Why did it happen? · What is likely to happen next? · What should I investigate?**

Decentra is a decision-intelligence workspace. Every answer it gives is
grounded in real numbers computed from your data — never hallucinated.
This guide walks a brand-new user through the first 10 minutes.

---

## 1. Sign in

1. Open the app in your browser.
2. You land on **Login**. The demo account is prefilled:
   - Email: `demo@decentra.ai`
   - Password: `demo1234`
3. Click **Enter workspace**. You're in.

> In production (`OPEN_REGISTRATION=false`) only the seeded demo account can
> sign in. To let others create accounts, set `OPEN_REGISTRATION=true` on the
> API and redeploy.

---

## 2. The Overview dashboard

After login you see **Overview** — your command center.

- **Greeting + focus sentence** — tells you what needs attention right now
  (e.g. "3 decisions to review, 2 overdue actions").
- **4 metric cards** — Decisions, Actions, Meetings, Health. Click any card
  to jump straight to that area.
- **Needs attention** feed — decisions awaiting review, overdue actions,
  unassigned actions. Click a row to open it.
- **Recent meetings / My actions / Decision stream / Open questions** —
  everything that happened recently, with links.
- **Health score** pill (top right) — 0–100, with confirmed/decision and
  completed/action rates. Click **View timeline** for the full audit trail.

---

## 3. Walk the core concept with the seeded dataset

The demo workspace ships with `samples/sales_demo.csv` already uploaded
(288 rows of monthly sales). Use it to see the whole pipeline:

1. Left sidebar → **Datasets**.
2. Click the seeded dataset (`Sales demo`).
3. You see, in tabs:
   - **Data Quality** — score (0–100) + completeness / validity / uniqueness /
     consistency breakdown, plus missing-value counts.
   - **KPIs** — auto-generated metrics (revenue, churn, customers) with trend.
   - **Analytics** — describe stats, trends, segmentation, correlations.
   - **Anomalies** — z-score / IQR outliers, each with the value, expected
     range, and deviation %.
   - **Predictions** — 6-month forecast with uncertainty bands and MAE/RMSE.
   - **Insights** — auto-generated findings (e.g. bottom-decile revenue).
   - **Recommendations** — ranked actions derived from insights.
4. **Assistant** tab — ask a question in plain English:
   - "Why did revenue decline?"
   - "What should I investigate first?"
   - Every answer comes with an **evidence panel** listing the exact KPI,
     segment, or anomaly it was computed from. Click **View Evidence** to see
     the underlying computation. The LLM never writes SQL — it only interprets
     evidence the engine already computed.

---

## 4. Run a meeting end-to-end

Meetings are the heart of Decentra. Decisions, actions, and risks are
extracted from the transcript and pinned to the second they were spoken.

### 4.1 Create a meeting

1. Sidebar → **Meetings** → **New meeting** (or the `+` button).
2. Enter a title and participant emails → **Create**.
3. You land on the meeting workspace (three tabs: Transcript, Intelligence,
   plus the upload area).

### 4.2 Add a transcript

Two ways:

- **Upload a transcript file** (works locally without an API key):
  - Click **Upload recording** and pick a `.json` or `.txt` file.
  - JSON format: `{"segments": [{"speaker": "Priya", "start": 0, "end": 9,
    "text": "…"}]}` (seconds). A sample is at `samples/meeting_transcript_sample.json`.
  - TXT: plain text; Decentra splits it into sentence segments.
- **Upload audio/video** (`.webm`, `.mp3`, `.wav`, `.m4a`, `.mp4`, `.mov`,
  `.ogg`): requires `OPENAI_API_KEY` set on the API for Whisper transcription.
  Without a key the job fails honestly with "transcription unavailable" —
  no fake dialogue is ever invented.

### 4.3 Process

1. Click **Process**. Status moves `draft → processing → ready` (polls
   automatically; you'll see a progress bar).
2. When `ready`, the **Transcript** tab shows every segment with speaker and
   timestamp. Click a segment to flash it; the evidence drawer shows which
   decisions/actions cite it.

### 4.4 Review the intelligence

Switch to the **Intelligence** tab:

- **Decisions** — each starts as `DETECTED` (amber). Click to confirm,
  revise, or reject. Confirmed decisions become organizational memory.
- **Actions** — owner, deadline, status. Edit owner/deadline inline; mark
  complete with the checkbox.
- **Questions** — open questions raised in the meeting.
- **Risks** — flagged concerns with severity.

Every item carries an **evidence link** (e.g. `42:17`) — click it to jump to
the exact transcript moment. Nothing is asserted without a source.

### 4.5 Lifecycle rules

- `DETECTED` → `CONFIRMED` / `REVISED` / `REJECTED` / `SUPERSEDED`
- Invalid statuses are rejected with `400`.
- Every mutation writes an audit-log row (visible in the activity feed).

---

## 5. Daily workflows

| Goal | Where |
|---|---|
| "What needs my attention?" | Overview → Needs attention feed |
| "My open tasks" | Sidebar → Actions (filter by owner=me) |
| "Decisions to review" | Sidebar → Decisions (filter DETECTED) |
| "Ask the data a question" | Datasets → pick dataset → Assistant tab |
| "See the full history" | Sidebar → Timeline |
| "Command palette" | `⌘K` / `Ctrl+K` anywhere |
| "Collapse the sidebar" | Bottom of sidebar → Collapse |

---

## 6. Keyboard & shortcuts

- `⌘K` / `Ctrl+K` — command palette (search meetings, decisions, actions)
- `Esc` — close modals / drawers
- `Tab` — move between focusable elements (all tap targets are ≥ 24px on touch)

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| "Transcription unavailable" | Upload a `.json`/`.txt` transcript, or set `OPENAI_API_KEY` on the API |
| Empty dataset list | You're in a fresh org — upload `samples/sales_demo.csv` |
| Meeting stuck on `processing` | Check API logs; usually a missing transcript source. Re-upload and re-process |
| Assistant answers are templated ("LLM unavailable") | `AI_PROVIDER=local` (default) or Groq/OpenAI key missing — set `AI_PROVIDER=groq` + `GROQ_API_KEY` |
| Predictions say "insufficient data" | Dataset needs a date column + ≥ 6 rows per month (fixed in latest build) |
| Web shows 500 on `/overview` | Restart `npm run dev` after a production build (stale `.next`) |

---

## 8. For developers

- Backend: `cd apps/api && uvicorn app.main:app --reload --port 8000`
- Frontend: `cd apps/web && npm run dev` (use `npm run dev:fresh` after a prod build)
- Tests: `cd apps/api && python -m pytest tests/` (54) and `cd apps/web && npm test` (16)
- Smoke: `powershell -ExecutionPolicy Bypass -File scripts/smoke.ps1` (13 checks)
- Docs: `/docs` on the API (Swagger), `docs/DEPLOY.md` for cloud deploy

---

*Decentra — meetings end, commitments shouldn't.*