# Deploying Decentra to the cloud

Two paths: **Railway** (simplest, ~$5–10/mo) or **Render free-forever**
($0, services sleep when idle — first load takes ~30 s to wake).

## Path A — Render free tier + Supabase ($0 forever)

Architecture: API + web as Render free Docker services, Postgres on
Supabase free tier (no expiry — unlike Render's own free Postgres, which
expires after 90 days). The web talks to the API through the same-origin
proxy, so auth cookies stay first-party with zero domain setup.

Known free-tier trade-offs (accepted by design):
- Cold starts: ~30 s after idle. Open the site a few minutes before presenting.
- Ephemeral disk: uploads vanish when the service sleeps/restarts. The seed
  dataset is one command away (`python seed_demo.py` in the API shell);
  re-upload anything else after a wake.

### 1. Supabase Postgres (free, no expiry)

1. Sign up at supabase.com → New project (any region near you).
2. Project Settings → Database → copy the **Connection string** (URI mode).
3. Adapt it for the API: change the scheme to `postgresql+asyncpg://` and
   append `?ssl=require`. Example:
   `postgresql+asyncpg://postgres:PASSWORD@db.abcd1234.supabase.co:5432/postgres?ssl=require`

### 2. Deploy the blueprint

1. Sign up at render.com → New → **Blueprint** → select this repo
   (`render.yaml` at the root wires both services).
2. When prompted, fill the `sync: false` values:
   - API `DATABASE_URL` ← your Supabase URL from step 1
   - API `GROQ_API_KEY` ← your Groq key
   - Web `API_INTERNAL_URL` ←public URL of the API service (deploy order:
     let the API finish first, copy its `.onrender.com` URL, then deploy web)
3. After web is live, go back to the API service → set `CORS_ORIGINS` to
   the web service's public URL → redeploy API.

### 3. Seed the single demo user

API service → Shell tab → `python seed_demo.py`. Expect
`Seeded demo@decentra.ai / org demo / dataset … (288 rows)`.
Login at the web URL as `demo@decentra.ai / demo1234` and walk the
interview checklist below.

## Path B — Railway (~15 min, paid usage)

No custom domain needed. The browser only talks to the **web** service;
Next.js proxies `/api/v1/*` to the API server-side, so auth cookies stay
first-party and CORS never bites. Total setup: ~15 minutes.

## 1. Create the project

1. Sign up at railway.app → **New Project** → **Deploy PostgreSQL**.
2. Note the `DATABASE_URL` variable (it uses `postgresql://…`). The API
   needs the async driver scheme: change the prefix to
   `postgresql+asyncpg://…` when you paste it below.

## 2. Deploy the API

1. **New Service** → **GitHub Repo** → select this repo.
2. Settings → **Root Directory** = `apps/api` (the `railway.json` there
   wires the Dockerfile build + `/readyz` healthcheck).
3. **Variables** (service → Variables tab):

   | Key | Value |
   |---|---|
   | `APP_ENV` | `production` |
   | `DATABASE_URL` | Postgres URL with `+asyncpg` scheme (see above) |
   | `SECRET_KEY` | 48+ random chars (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) |
   | `STORAGE_PATH` | `/app/storage` (must match the volume mount below) |
   | `CORS_ORIGINS` | your web service public URL (e.g. `https://decentra-web.up.railway.app`) |
   | `LOG_LEVEL` | `INFO` |
   | `OPEN_REGISTRATION` | `false` for the demo build (only the seeded demo account can sign in — no email verification needed) |
   | `AI_PROVIDER` | `local` for deterministic demo answers, or `groq` + `GROQ_API_KEY` for live LLM interpretation (open-source Llama 3.3 70B, fast + free tier) |

4. **Volumes**: add a volume mounted at `/app/storage` so uploads survive
   redeploys.
5. Deploy. The service is healthy when `/readyz` returns `{"ready": true}`.
   Copy its **private** URL (`http://<service>.railway.internal:8000`) —
   web uses it, never the public one.

## 3. Seed the single demo user

One-off command on the API service (**Settings → Deploy → Custom Start
Command** temporarily, or the service shell):

```bash
python seed_demo.py
```

This creates `demo@decentra.ai / demo1234`, the Demo Workspace org, and the
sales dataset with its quality report. Idempotent — safe to re-run.

## 4. Deploy the web

1. **New Service** → same repo, **Root Directory** = `apps/web`.
2. **Variables**:

   | Key | Value |
   |---|---|
   | `API_INTERNAL_URL` | API **private** URL from step 2 (server-side proxy target) |
   | `NODE_ENV` | `production` |

   Leave `NEXT_PUBLIC_API_URL` **unset** — same-origin mode needs no build
   arg and no rebuild when the API moves.
3. Generate a public domain for the web service. Done — open it, sign in
   as the demo user, present.

## 5. Interview-day checklist

- [ ] Web loads, login works as `demo@decentra.ai / demo1234`
- [ ] Datasets → sales demo → quality score visible (proves the pipeline)
- [ ] Ask the assistant a question, open **View Evidence**
- [ ] Upload works (volume mounted — files survive redeploys)
- [ ] `/readyz` on the API returns ready (show the health slide if asked)

## Notes

- **Realtime behavior**: answers stream token-by-token (SSE) with evidence
  first; repeats are served from a fingerprint-invalidated answer cache
  (`⚡ instant` badge in the UI); Groq calls retry transient 429/5xx with
  backoff and a 25 s timeout, then fall back to local templates. Tune via
  `ASSISTANT_CACHE_TTL_SECONDS`, `LLM_TIMEOUT_SECONDS`, `LLM_MAX_RETRIES`.
- **Load**: the API runs `${UVICORN_WORKERS:-2}` workers with rate limits
  shared over Redis (prod compose includes it). Groq free tier shares
  capacity — expect tail spikes; move to a paid tier when p95 matters.

- **No custom domain?** Nothing above needs one — Railway's default
  `*.up.railway.app` (web) + `*.railway.internal` (API) is the whole
  network. Add a custom domain later without code changes.
- **Split-domain future** (web and API on different public hosts):
  set `COOKIE_SAMESITE=none` on the API (requires HTTPS, which Railway
  provides) and `NEXT_PUBLIC_API_URL` to the API's public URL at web
  build time.
- **Backups**: Railway Postgres has automated backups on paid plans —
  enable them before real consumer data lands.
- **Logs**: `railway logs` per service; every API error carries
  `request_id` + `X-Request-ID` header for tracing.
