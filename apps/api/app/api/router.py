from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.auth.security import (
    get_current_user, hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token, persist_refresh_token,
    rotate_refresh_token, mark_replaced, _revoke_family,
)
from app.config.settings import get_settings
from app.rate_limit import limiter
from app.schemas.common import UserCreate, UserLogin, TokenResponse, UserOut, OrgCreate, OrgOut, DatasetOut
from app.models.entities import User, Organization, OrganizationMember, Dataset
import re

router = APIRouter(prefix="/api/v1")
settings = get_settings()

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_refresh_cookie(response: Response, token: str) -> None:
    samesite = settings.cookie_samesite.strip().lower()
    if samesite not in ("lax", "strict", "none"):
        samesite = "lax"
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=settings.refresh_token_expire_days * 24 * 3600,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        # localhost dev is http; prod and SameSite=None must be https
        secure=settings.is_production or samesite == "none",
        samesite=samesite,  # lax = same-site (proxy/single domain); none = split domains
    )


async def _issue_tokens(user_id: str, response: Response, db: AsyncSession) -> TokenResponse:
    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)
    # Persist the refresh jti so each token is single-use (rotation).
    payload = decode_token(refresh)
    await persist_refresh_token(db, jti=payload["jti"], user_id=user_id)
    _set_refresh_cookie(response, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh)

def slugify(name: str) -> str:
    s = re.sub(r'[^a-zA-Z0-9]+', '-', name.lower()).strip('-')
    return s or "org"

@router.post("/auth/register", response_model=TokenResponse)
@limiter.limit("10/hour")
async def register(request: Request, response: Response, body: UserCreate, db: AsyncSession = Depends(get_db)):
    if not settings.open_registration:
        raise HTTPException(status_code=403, detail="Registration is disabled on this instance")
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=body.email, password_hash=hash_password(body.password), full_name=body.full_name)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return await _issue_tokens(user.id, response, db)

@router.post("/auth/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, response: Response, body: UserLogin, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.email == body.email))
    user = r.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return await _issue_tokens(user.id, response, db)

@router.post("/auth/refresh", response_model=TokenResponse)
@limiter.limit("60/minute")
async def refresh(request: Request, response: Response, body: dict, db: AsyncSession = Depends(get_db)):
    # Prefer the httpOnly cookie (browser clients never touch the token);
    # fall back to the body for non-browser API consumers.
    token = (body or {}).get("refresh_token") or request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=400, detail="refresh_token required")
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    old_jti = payload.get("jti")
    if not old_jti:
        # Pre-rotation token (issued before this release): accept once, then
        # move it onto the ledger.
        uid = payload.get("sub")
        return await _issue_tokens(uid, response, db)
    uid = await rotate_refresh_token(db, old_jti)
    issued = await _issue_tokens(uid, response, db)
    await mark_replaced(db, old_jti, decode_token(issued.refresh_token)["jti"])
    return issued

@router.post("/auth/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    # Server-side revoke: a stolen refresh token must die at logout, not
    # just disappear from the browser's cookie jar.
    # Logout = log out everywhere: revoke the whole refresh family so a
    # stolen token cannot outlive the user's goodbye. (Per-device sessions
    # can narrow this later; the safe default is total revocation.)
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        try:
            payload = decode_token(token)
            uid = payload.get("sub")
            if uid:
                await _revoke_family(db, uid)
        except Exception:
            pass  # logout is best-effort; the cookie is cleared regardless
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)
    return {"logged_out": True}

@router.get("/auth/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, email=user.email, full_name=user.full_name, created_at=user.created_at)

@router.post("/organizations", response_model=OrgOut)
async def create_org(body: OrgCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    slug = body.slug or slugify(body.name)
    # ensure unique
    base = slug
    i = 1
    while True:
        r = await db.execute(select(Organization).where(Organization.slug == slug))
        if not r.scalar_one_or_none():
            break
        slug = f"{base}-{i}"
        i += 1
    org = Organization(name=body.name, slug=slug, created_by=user.id)
    db.add(org)
    await db.flush()
    member = OrganizationMember(org_id=org.id, user_id=user.id, role="ADMIN")
    db.add(member)
    await db.commit()
    await db.refresh(org)
    return OrgOut(id=org.id, name=org.name, slug=org.slug, created_at=org.created_at)

@router.get("/organizations", response_model=list[OrgOut])
async def list_orgs(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    r = await db.execute(select(Organization).join(OrganizationMember, Organization.id == OrganizationMember.org_id).where(OrganizationMember.user_id == user.id))
    orgs = r.scalars().all()
    return [OrgOut(id=o.id, name=o.name, slug=o.slug, created_at=o.created_at) for o in orgs]

@router.get("/organizations/{org_id}/members")
async def list_members(org_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    # check membership
    m = await db.execute(select(OrganizationMember).where(OrganizationMember.org_id == org_id, OrganizationMember.user_id == user.id))
    if not m.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")
    r = await db.execute(select(OrganizationMember).where(OrganizationMember.org_id == org_id))
    members = r.scalars().all()
    # join user emails
    out = []
    for mem in members:
        u = await db.execute(select(User).where(User.id == mem.user_id))
        usr = u.scalar_one_or_none()
        out.append({"user_id": mem.user_id, "email": usr.email if usr else None, "role": mem.role})
    return out

@router.get("/datasets", response_model=list[DatasetOut])
async def list_datasets(org_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    # org membership check
    m = await db.execute(select(OrganizationMember).where(OrganizationMember.org_id == org_id, OrganizationMember.user_id == user.id))
    if not m.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized for organization")
    r = await db.execute(select(Dataset).where(Dataset.org_id == org_id).order_by(Dataset.created_at.desc()))
    ds = r.scalars().all()
    return [DatasetOut(id=d.id, org_id=d.org_id, name=d.name, description=d.description, source_type=d.source_type, row_count=d.row_count, column_count=d.column_count, status=d.status, created_at=d.created_at) for d in ds]

# Lightweight health datasets endpoint without org filter (for dev convenience)
@router.get("/datasets/all", response_model=list[DatasetOut])
async def list_all_datasets(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    # return datasets from orgs user belongs to
    r = await db.execute(select(Dataset).join(OrganizationMember, Dataset.org_id == OrganizationMember.org_id).where(OrganizationMember.user_id == user.id).order_by(Dataset.created_at.desc()))
    ds = r.scalars().all()
    return [DatasetOut(id=d.id, org_id=d.org_id, name=d.name, description=d.description, source_type=d.source_type, row_count=d.row_count, column_count=d.column_count, status=d.status, created_at=d.created_at) for d in ds]
