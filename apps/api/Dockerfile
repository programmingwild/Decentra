FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps for asyncpg/psycopg + scientific stack wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 10001 appuser

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# Storage dir must be writable by the non-root user (or mount a volume).
RUN mkdir -p storage && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/readyz || exit 1

# NOTE: schema is created by the app on boot (Base.metadata.create_all).
# Run `alembic upgrade head` in CI/release jobs once real migrations exist —
# never swallow migration failures with `|| true` in production.
# Workers scale with CPU (2×cores+1 rule of thumb, capped by Postgres pool);
# SQLite dev tolerates 1–2 writers, Postgres carries the fleet.
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --workers ${UVICORN_WORKERS:-2}"]
