import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app.config.settings import get_settings
from app.rate_limit import limiter
from app.database.session import engine
from app.database.base import Base
from app.models.entities import *  # ensure models registered
from app.api.router import router as router_v1
from app.api.router_v2 import router_v2
from app.api.routes.meetings import router as meetings_router
from app.api.routes.elimination import elimination_router  # prevention layer (additive)

settings = get_settings()

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO),
                    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("decentra")

# Error tracking: entirely opt-in. No SENTRY_DSN = zero overhead, zero network.
_sentry_dsn = os.environ.get("SENTRY_DSN", "")
if _sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration

        sentry_sdk.init(
            dsn=_sentry_dsn,
            integrations=[FastApiIntegration()],
            traces_sample_rate=0.1,
            environment=settings.app_env,
        )
        logger.info("Sentry error tracking enabled")
    except ImportError:
        logger.warning("SENTRY_DSN set but sentry-sdk is not installed")


def _req_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


def _envelope(request: Request, detail: str, code: int, **extra):
    body = {"detail": detail, "code": code, "request_id": _req_id(request)}
    body.update(extra)
    return JSONResponse(status_code=code, content=body)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting Decentra API (env={settings.app_env}, db={engine.url.get_backend_name()})")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database ready")
    yield


app = FastAPI(
    title="Decentra API",
    version="1.0.0",
    description="AI Meeting Intelligence & Decision Execution Platform",
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

if settings.is_production:
    # Rejects Host-header attacks; configure TRUSTED_HOSTS for your domain.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts_list)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    req_id = str(uuid.uuid4())[:8]
    request.state.request_id = req_id
    response = await call_next(request)
    duration = (time.time() - start) * 1000
    logger.info(f"{req_id} {request.method} {request.url.path} {response.status_code} {duration:.1f}ms")
    response.headers["X-Request-ID"] = req_id
    return response


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    # Reject oversized bodies by header BEFORE any endpoint reads them
    # into memory. Caps at the largest legitimate upload + multipart overhead.
    cap = max(settings.max_upload_mb, settings.max_recording_mb) + 10
    try:
        length = int(request.headers.get("content-length", "0") or "0")
    except ValueError:
        length = 0
    if length > cap * 1024 * 1024:
        return JSONResponse(
            status_code=413,
            content={"detail": f"Request body too large (max {cap}MB)", "code": 413,
                     "request_id": getattr(request.state, "request_id", "unknown")},
        )
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


@app.exception_handler(HTTPException)
async def http_exc_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTP {exc.status_code} at {request.url.path}: {exc.detail}")
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return _envelope(request, detail, exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error at {request.url.path}: {exc.errors()}")
    summary = "; ".join(
        f"{'.'.join(str(p) for p in e.get('loc', []))}: {e.get('msg', 'invalid')}".strip(": ")
        for e in exc.errors()[:5]
    )
    return _envelope(request, summary or "Invalid request", 422, errors=exc.errors())


@app.exception_handler(FileNotFoundError)
async def missing_artifact_handler(request: Request, exc: FileNotFoundError):
    logger.warning(f"Missing storage artifact at {request.url.path}")
    return _envelope(request, "Dataset artifact not found", 404)


@app.exception_handler(IntegrityError)
async def integrity_handler(request: Request, exc: IntegrityError):
    logger.warning(f"Integrity conflict at {request.url.path}: {type(exc.orig).__name__ if exc.orig else 'conflict'}")
    return _envelope(request, "Resource already exists", 400)


@app.exception_handler(Exception)
async def generic_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error at {request.url.path}: {exc}")
    return _envelope(request, "Internal server error", 500)


app.include_router(router_v1)
app.include_router(router_v2)
app.include_router(meetings_router)
app.include_router(elimination_router)


async def _db_ok() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.exception("Health check: database unreachable")
        return False


@app.get("/health")
async def health():
    # Deep check: orchestrators / load balancers must not route here if the DB is down.
    db_ok = await _db_ok()
    storage = settings.storage_path
    storage_ok = os.path.isdir(storage) or not os.path.exists(storage)
    ok = db_ok and storage_ok
    return JSONResponse(
        status_code=200 if ok else 503,
        content={"status": "ok" if ok else "degraded", "version": "1.0.0",
                 "checks": {"database": "up" if db_ok else "down",
                            "storage": "up" if storage_ok else "down"}},
    )


@app.get("/readyz")
async def readyz():
    if not await _db_ok():
        return JSONResponse(status_code=503, content={"ready": False})
    return {"ready": True}


@app.get("/")
async def root():
    return {"name": "Decentra API", "docs": "/docs" if settings.docs_enabled else None}
