# Decentra on Render + Supabase (your step-by-step)

Everything technical is already prepared in this repo. What remains needs
your accounts/inputs.

Repo URL (for Render): https://github.com/programmingwild/Decentra

## 1. Supabase (free Postgres)
1. Create/sign in at https://supabase.com
2. Project Settings → Database → **Connection string** — copy the URI.
3. Convert for the app: change scheme to `postgresql+asyncpg://` and append `?ssl=require`:
   `postgresql+asyncpg://postgres:PASSWORD@db.<project-ref>.supabase.co:5432/postgres?ssl=require`

## 2. Render services (from render.yaml blueprint — automatic)
Render dashboard → **New → Blueprint** → connect this repo
→ it creates `decentra-api` and `decentra-web`.

Fill in the blank secrets it prompts for:

`decentra-api`:
- `DATABASE_URL` = `postgresql+asyncpg://postgres:YOUR_PASSWORD@db.<project-ref>.supabase.co:5432/postgres?ssl=require`
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

## 4. Seed demo data
API service → **Shell**:
```bash
python seed_demo.py
```
Expect: `Quality score: 98.9` / `Seeded demo@decentra.ai … (288 rows)`.
Log in at the web URL: `demo@decentra.ai / demo1234`.

## Notes
- Free tier cold starts (~30–60s first hit after idle). Acceptable for demo.
- Your Supabase free tier has NO 90-day expiry (unlike Render free Postgres).
- Local Docker stack stays your dev environment; Render replaces it online.
