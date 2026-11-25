# Decentra on Render + Neon (your step-by-step)

Everything technical is already prepared in this repo. What remains needs
your accounts/inputs.

Repo URL (for Render): https://github.com/programmingwild/Decentra

## 1. Neon Postgres (free, recommended)
1. Create/sign in at https://neon.tech → New Project (any region).
2. Dashboard → **Connection string** — copy the direct URI.
3. Convert for the app: change scheme to `postgresql+asyncpg://` and append `?sslmode=require`:
   `postgresql+asyncpg://USER:PASSWORD@ep-xxxx-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require`

Neon compute auto-suspends after ~5 min idle but **resumes automatically**
on the next connection — no manual restore step (Supabase free projects pause
after ~7 days and must be restored from the dashboard). The API's
`pool_pre_ping` reconnects transparently after a suspend.

Alternative (Supabase): Project Settings → Database → connection URI, change
scheme to `postgresql+asyncpg://` and append `?ssl=require`
(`postgresql+asyncpg://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres?ssl=require`).

## 2. Render services (from render.yaml blueprint — automatic)
Render dashboard → **New → Blueprint** → connect this repo
→ it creates `decentra-api` and `decentra-web`.

Fill in the blank secrets it prompts for:

`decentra-api`:
- `DATABASE_URL` = your Neon URL from step 1 with the `+asyncpg` scheme (or Supabase URL)
- `GROQ_API_KEY` = your Groq key (same one in local `.env`) — never pasted in chat,
  set directly in the Render env var field
- `CORS_ORIGINS` = leave EMPTY for now, set after step 3, then redeploy

`decentra-web`:
- `API_INTERNAL_URL` = `https://decentra-api.onrender.com` (set after API is live)

## 3. Wire CORS
After web deploys:
1. Note web URL, e.g. `https://decentra-web.onrender.com`
2. API service → Environment → set `CORS_ORIGINS` to that URL
3. **Redeploy** the API service

## 4. Seed demo data (after switching databases)
The new database is empty; the API creates all tables on startup. In the API
service → **Shell**:
```bash
python seed_demo.py
```
Expect: `Quality score: 98.9` / `Seeded demo@decentra.ai … (288 rows)`.
Log in at the web URL: `demo@decentra.ai / demo1234`.

## Notes
- Free tier cold starts (~30–60s first hit after idle). Acceptable for demo.
- Neon free Postgres has no 90-day expiry (unlike Render free Postgres) and
  resumes automatically after idle; Supabase free pauses after ~7 days idle.
- Local Docker stack stays your dev environment; Render replaces it online.
