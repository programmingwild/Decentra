"""Robustness regression tests: auth cookies, rate limits, validation,
health depth, upload caps, production secret guard.
"""
import io

import pytest
from fastapi import UploadFile

from app.config.settings import DEFAULT_SECRET, Settings
from app.utils.uploads import read_upload_capped


async def _register(client, email="robust@decentra.ai", password="strongpass1"):
    r = await client.post("/api/v1/auth/register",
                          json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.asyncio
async def test_health_reports_checks(client):
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["checks"]["database"] == "up"
    assert "request_id" not in body  # success body needs no request id


@pytest.mark.asyncio
async def test_readyz(client):
    r = await client.get("/readyz")
    assert r.status_code == 200
    assert r.json() == {"ready": True}


@pytest.mark.asyncio
async def test_register_sets_httponly_refresh_cookie(client):
    r = await client.post("/api/v1/auth/register",
                          json={"email": "cookie@decentra.ai", "password": "strongpass1"})
    assert r.status_code == 200
    cookie = r.headers.get("set-cookie", "")
    assert "refresh_token=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie


@pytest.mark.asyncio
async def test_refresh_works_from_cookie_only(client):
    await _register(client, email="cookierefresh@decentra.ai")
    # Empty body: server must fall back to the httpOnly cookie the
    # AsyncClient jar kept from the register response.
    r = await client.post("/api/v1/auth/refresh", json={})
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]


@pytest.mark.asyncio
async def test_logout_clears_cookie(client):
    await _register(client, email="logout@decentra.ai")
    r = await client.post("/api/v1/auth/logout")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_short_password_rejected_with_envelope(client):
    r = await client.post("/api/v1/auth/register",
                          json={"email": "short@decentra.ai", "password": "123"})
    assert r.status_code == 422
    body = r.json()
    assert isinstance(body["detail"], str)  # consistent string detail
    assert body["code"] == 422
    assert body["request_id"]


def test_expired_vs_invalid_token_messages():
    from app.auth.security import create_access_token, decode_token
    from fastapi import HTTPException
    payload = decode_token(create_access_token("u1"))
    assert payload["type"] == "access"
    with pytest.raises(HTTPException) as ei:
        decode_token("garbage.token.here")
    assert ei.value.detail == "Invalid token"


def test_production_refuses_default_secret():
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(app_env="production", secret_key=DEFAULT_SECRET)
    with pytest.raises(ValueError, match="at least 32"):
        Settings(secret_key="short")


@pytest.mark.asyncio
async def test_upload_cap_enforced_before_full_buffer():
    big = UploadFile(filename="x.csv", file=io.BytesIO(b"a" * 2048))
    with pytest.raises(ValueError, match="too large"):
        await read_upload_capped(big, 1024)
    small = UploadFile(filename="x.csv", file=io.BytesIO(b"a" * 512))
    assert len(await read_upload_capped(small, 1024)) == 512


@pytest.mark.asyncio
async def test_login_rate_limited(client):
    await _register(client, email="ratelimit@decentra.ai")
    statuses = []
    for _ in range(12):
        r = await client.post("/api/v1/auth/login",
                              json={"email": "ratelimit@decentra.ai", "password": "strongpass1"})
        statuses.append(r.status_code)
    assert 429 in statuses  # 10/minute bucket must trip


@pytest.mark.asyncio
async def test_refresh_reuse_inside_grace_stays_valid(client):
    reg = await _register(client, email="grace@decentra.ai")
    old = reg["refresh_token"]
    r1 = await client.post("/api/v1/auth/refresh", json={"refresh_token": old})
    assert r1.status_code == 200, r1.text
    # Same token again at once (two tabs): grace window tolerates it.
    r2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": old})
    assert r2.status_code == 200, r2.text


@pytest.mark.asyncio
async def test_refresh_reuse_past_grace_burns_family(client, monkeypatch):
    import app.auth.security as sec
    monkeypatch.setattr(sec, "REUSE_GRACE_SECONDS", -1)  # every reuse is theft
    reg = await _register(client, email="theft@decentra.ai")
    old = reg["refresh_token"]
    r1 = await client.post("/api/v1/auth/refresh", json={"refresh_token": old})
    assert r1.status_code == 200, r1.text
    successor = r1.json()["refresh_token"]
    # Replay the consumed token: theft → 401 and the whole family dies.
    r2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": old})
    assert r2.status_code == 401
    assert "compromised" in r2.text
    r3 = await client.post("/api/v1/auth/refresh", json={"refresh_token": successor})
    assert r3.status_code == 401  # family revoked


@pytest.mark.asyncio
async def test_logout_kills_refresh_token(client):
    reg = await _register(client, email="killswitch@decentra.ai")
    token = reg["refresh_token"]
    r = await client.post("/api/v1/auth/logout")
    assert r.status_code == 200
    # Family revoked: replaying the token (body or cookie) must fail,
    # and the ledger row is marked revoked.
    r2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": token})
    assert r2.status_code == 401
    from app.auth.security import decode_token
    jti = decode_token(token)["jti"]
    from tests.conftest import TestSession
    from app.models.entities import RefreshToken
    async with TestSession() as s:
        row = await s.get(RefreshToken, jti)
        assert row is not None and row.revoked_at is not None


@pytest.mark.asyncio
async def test_concurrent_registers_no_500(client):
    """Writer contention (WAL + busy timeout) must never 500 concurrent
    signups — regression for the load-probe 500s."""
    import asyncio

    async def one(i):
        r = await client.post("/api/v1/auth/register",
                              json={"email": f"race{i}@decentra.ai", "password": "strongpass1"})
        return r.status_code

    statuses = await asyncio.gather(*[one(i) for i in range(8)])
    assert set(statuses) == {200}, statuses


@pytest.mark.asyncio
async def test_closed_registration_rejects(client, monkeypatch):
    """Demo/single-user instances refuse new signups; seeded logins unaffected."""
    import app.api.router as router_mod
    monkeypatch.setattr(router_mod.settings, "open_registration", False)
    r = await client.post("/api/v1/auth/register",
                          json={"email": "nobody@decentra.ai", "password": "strongpass1"})
    assert r.status_code == 403
    assert "disabled" in r.text
