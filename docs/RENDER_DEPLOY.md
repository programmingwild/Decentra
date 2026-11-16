# Deploy Decentra to Render (free tier) + Supabase

This repo is already Render-ready via [`render.yaml`](../render.yaml). You need to click through the Render dashboard (I can't create cloud accounts or paste your passwords), but everything else is prepared.

## 1. Create the database (Supabase, free, no expiry)
1. supabase.com → New project (any region).
2. Project Settings → Database → copy the connection string (URI).
3. Convert it for the API — scheme `postgresql+asyncpg://` and append `?ssl=require`:
   `postgresql+asyncpg://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres?ssl=require`

## 2. Deploy the blueprint
Render dashboard → **New → Blueprint** → select `programmingwild/Decentra` (render.yaml wires both services).

Fill in the `sync: false` secrets when prompted:

### `decentra-api` service
| Key | Value |
|---|---|
| `DATABASE_URL` | Supabase URL from step 1 (`postgresql+asyncpg://…?ssl=require`) |
| `GROQ_API_KEY` | your Groq key (or set `AI_PROVIDER=local` to skip Groq entirely) |
| `CORS_ORIGINS` | leave blank for now — set to the web URL after web deploys, then **redeploy** the API |

`APP_ENV=production`, `SECRET_KEY`, `STORAGE_PATH`, `OPEN_REGISTRATION=false`, `LOG_LEVEL`, `AI_PROVIDER=groq`, `GROQ_MODEL`, etc. are pre-filled in the blueprint. `SECRET_KEY` is auto-generated on deploy (don't reuse the local `.env` one).

### `decentra-web` service
| Key | Value |
|---|---|
| `API_INTERNAL_URL` | the API service's public URL, e.g. `https://decentra-api.onrender.com` (set **after** the API is up; copy its URL) |

## 3. Wire CORS (web → API)
1. After web is live, note its URL (`https://decentra-web.onrender.com`).
2. Back in the API service → Environment → set `CORS_ORIGINS` to that web URL.
3. **Redeploy** the API.

## 4. Seed the single demo user
API service → **Shell** tab:
```bash
python seed_demo.py
```
Expect: `Seeded demo@decentra.ai / org demo / dataset … (288 rows)`.

Log in at the web URL with `demo@decentra.ai / demo1234`.

## 5. Cold starts (free tier)
Free web services sleep after ~15 min idle; first request can take ~30–60s and uploads don't persist across sleeps. Open the site a few minutes before presenting, or upgrade the service to an always-on instance.

## Alternative: Railway
See [`./DEPLOY.md`](./DEPLOY.md) ("Path B"). Same env vars; web uses the API's **internal/private** URL via `API_INTERNAL_URL`.
