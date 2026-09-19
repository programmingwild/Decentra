import logging

from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config.settings import get_settings

log = logging.getLogger("decentra")
settings = get_settings()

# SQLite needs check_same_thread handling via connect_args.
# Postgres gets a tuned pool: pre-ping drops dead connections (common behind
# load balancers / after DB restarts) instead of serving 500s.
connect_args = {}
engine_kwargs: dict = {"echo": False}
if "sqlite" in settings.database_url:
    connect_args = {"check_same_thread": False, "timeout": 30}
else:
    engine_kwargs.update(pool_size=5, max_overflow=10, pool_pre_ping=True, pool_recycle=1800)

engine = create_async_engine(settings.database_url, connect_args=connect_args, **engine_kwargs)

if "sqlite" in settings.database_url:
    # WAL: readers never block writers. Without this, two uvicorn workers
    # turn concurrent writes (login quota: refresh rows, assistant quota:
    # messages/cache) into "database is locked" 500s under load.
    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.execute("PRAGMA busy_timeout=30000")
        cur.close()

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
