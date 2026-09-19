from datetime import datetime, timedelta, timezone
import uuid as uuidlib
from jose import jwt, JWTError, ExpiredSignatureError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.config.settings import get_settings
from app.database.session import get_db
from app.models.entities import User, RefreshToken

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# auto_error=False: a missing header flows into our JSON envelope
# ({"detail","code","request_id"}) instead of a bare framework 403.
bearer = HTTPBearer(auto_error=False)
settings = get_settings()

def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(sub: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": sub, "exp": exp, "type": "access"}, settings.secret_key, algorithm=settings.jwt_algorithm)

def create_refresh_token(sub: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    return jwt.encode({"sub": sub, "exp": exp, "type": "refresh", "jti": str(uuidlib.uuid4())}, settings.secret_key, algorithm=settings.jwt_algorithm)


def _naive_now() -> datetime:
    # DateTime columns round-trip naive on SQLite; compare naive everywhere.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _as_naive(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None) if getattr(dt, "tzinfo", None) else dt


# Re-presenting a revoked token within this window is treated as a benign
# concurrent client (two tabs), not theft — it still yields a fresh pair.
REUSE_GRACE_SECONDS = 30


async def persist_refresh_token(db: AsyncSession, *, jti: str, user_id: str) -> None:
    exp = _naive_now() + timedelta(days=settings.refresh_token_expire_days)
    db.add(RefreshToken(jti=jti, user_id=user_id, expires_at=exp))
    await db.commit()


async def _revoke_family(db: AsyncSession, user_id: str) -> None:
    now = _naive_now()
    rows = (await db.execute(
        select(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
    )).scalars().all()
    for row in rows:
        row.revoked_at = now
    # prune long-expired rows so the ledger can't grow unbounded
    await db.execute(delete(RefreshToken).where(RefreshToken.expires_at < now))
    await db.commit()


async def rotate_refresh_token(db: AsyncSession, jti: str) -> str:
    """Consume a refresh-token row, returning the user id.

    Raises 401 on unknown/expired tokens. Re-presenting a consumed token is
    allowed exactly once per grace window and only while its successor is
    still alive (two tabs racing) — otherwise it is theft or a post-logout
    replay, and the whole family is revoked.
    """
    row = await db.get(RefreshToken, jti)
    if row is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    now = _naive_now()
    if _as_naive(row.expires_at) <= now:
        await db.delete(row)
        await db.commit()
        raise HTTPException(status_code=401, detail="Token expired")
    if row.revoked_at is not None:
        age = (now - _as_naive(row.revoked_at)).total_seconds()
        successor_alive = False
        if row.replaced_by:
            succ = await db.get(RefreshToken, row.replaced_by)
            successor_alive = succ is not None and succ.revoked_at is None
        if successor_alive and age <= REUSE_GRACE_SECONDS:
            return row.user_id  # benign concurrent client
        await _revoke_family(db, row.user_id)
        raise HTTPException(status_code=401, detail="Session compromised — sign in again")
    row.revoked_at = now
    await db.commit()
    return row.user_id


async def mark_replaced(db: AsyncSession, old_jti: str, new_jti: str) -> None:
    row = await db.get(RefreshToken, old_jti)
    if row is not None:
        row.replaced_by = new_jti
        await db.commit()

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except ExpiredSignatureError as e:
        # Distinct message lets clients silently refresh instead of logging out.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from e
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from e

async def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: AsyncSession = Depends(get_db)) -> User:
    if creds is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(creds.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
