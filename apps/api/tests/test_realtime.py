"""Realtime guarantees: answer cache (hit/miss/invalidation), LLM retry,
SSE shape, streaming fallbacks. No network — local provider + stubs.
"""
import httpx
import openai
import pytest

from app.ai.provider import (GroqProvider, LocalProvider, chat_completion,
                             stream_chat)

CSV = "date,region,revenue\n2024-01-01,North,100\n2024-02-01,North,120\n2024-03-01,South,90\n"


@pytest.fixture(autouse=True)
def _local_ai(monkeypatch):
    """Deterministic provider: tests must never depend on the developer's
    .env (which may point at Groq) nor on network."""
    from app.config.settings import Settings as S

    def _local():
        return S(ai_provider="local", openai_api_key="", groq_api_key="")

    # router_v2 binds get_settings at module top; meetings.py imports it
    # inside functions (resolves via app.config.settings at call time).
    monkeypatch.setattr("app.api.router_v2.get_settings", _local)
    monkeypatch.setattr("app.config.settings.get_settings", _local)


async def _upload(client, H, org_id, name="rt.csv", csv=CSV):
    import io
    files = {"file": (name, csv.encode(), "text/csv")}
    data = {"org_id": org_id, "name": "rt"}
    # httpx multipart with extra fields:
    r = await client.post("/api/v1/datasets/upload", files=files, data=data, headers=H)
    assert r.status_code == 200, r.text
    return r.json()["dataset"]["id"]


@pytest.mark.asyncio
async def test_dataset_cache_miss_then_hit(client):
    r = await client.post("/api/v1/auth/register",
                          json={"email": "cache1@decentra.ai", "password": "strongpass1"})
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}
    org = (await client.post("/api/v1/organizations", json={"name": "C"}, headers=H)).json()
    did = await _upload(client, H, org["id"])
    q = {"question": "What is total revenue?"}
    r1 = await client.post(f"/api/v1/datasets/{did}/assistant/query", json=q, headers=H)
    assert r1.status_code == 200
    assert r1.json().get("cached") is not True
    r2 = await client.post(f"/api/v1/datasets/{did}/assistant/query", json=q, headers=H)
    assert r2.status_code == 200
    assert r2.json().get("cached") is True
    assert r2.json()["latency_ms"] == 0
    assert r2.json()["answer"] == r1.json()["answer"]


@pytest.mark.asyncio
async def test_dataset_cache_invalidated_by_new_upload(client):
    r = await client.post("/api/v1/auth/register",
                          json={"email": "cache2@decentra.ai", "password": "strongpass1"})
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}
    org = (await client.post("/api/v1/organizations", json={"name": "C2"}, headers=H)).json()
    did = await _upload(client, H, org["id"])
    q = {"question": "Summarize revenue?"}
    await client.post(f"/api/v1/datasets/{did}/assistant/query", json=q, headers=H)
    r2 = await client.post(f"/api/v1/datasets/{did}/assistant/query", json=q, headers=H)
    assert r2.json().get("cached") is True
    # new data, same dataset id? upload creates a NEW dataset; re-upload to a
    # second dataset must not serve the first dataset's answer: different key
    did2 = await _upload(client, H, org["id"], name="rt2.csv",
                         csv=CSV + "2024-04-01,East,500\n")
    r3 = await client.post(f"/api/v1/datasets/{did2}/assistant/query", json=q, headers=H)
    assert r3.json().get("cached") is not True


@pytest.mark.asyncio
async def test_meetings_cache_hit(client):
    r = await client.post("/api/v1/auth/register",
                          json={"email": "cache3@decentra.ai", "password": "strongpass1"})
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}
    org = (await client.post("/api/v1/organizations", json={"name": "C3"}, headers=H)).json()
    q = {"question": "What did we decide?"}
    r1 = await client.post(f"/api/v1/assistant/query?org_id={org['id']}", json=q, headers=H)
    assert r1.status_code == 200
    r2 = await client.post(f"/api/v1/assistant/query?org_id={org['id']}", json=q, headers=H)
    assert r2.json().get("cached") is True


def _rate_limit():
    req = httpx.Request("POST", "https://api.groq.com/openai/v1/x")
    return openai.RateLimitError("slow down", response=httpx.Response(429, request=req), body=None)


class _StubCompletions:
    def __init__(self, script):
        self.script = list(script)
        self.calls = 0

    async def create(self, **kw):
        self.calls += 1
        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


class _StubChat:
    def __init__(self, script):
        self.completions = _StubCompletions(script)


class _StubClient:
    def __init__(self, script):
        self.chat = _StubChat(script)


def _ok():
    class _M:
        content = '{"answer": "hi"}'
    class _C:
        message = _M()
    class _R:
        choices = [_C()]
    return _R()


@pytest.mark.asyncio
async def test_retry_then_success():
    c = _StubClient([_rate_limit(), _rate_limit(), _ok()])
    out = await chat_completion(c, max_retries=3, base_seconds=0.01, model="m", messages=[])
    assert out.choices[0].message.content == '{"answer": "hi"}'
    assert c.chat.completions.calls == 3


@pytest.mark.asyncio
async def test_no_retry_on_auth_error():
    req = httpx.Request("POST", "https://x")
    err = openai.AuthenticationError("bad key",
                                     response=httpx.Response(401, request=req), body=None)
    c = _StubClient([err])
    with pytest.raises(openai.AuthenticationError):
        await chat_completion(c, max_retries=3, base_seconds=0.01, model="m", messages=[])
    assert c.chat.completions.calls == 1


@pytest.mark.asyncio
async def test_retry_exhausted_raises():
    c = _StubClient([_rate_limit()] * 5)
    with pytest.raises(openai.RateLimitError):
        await chat_completion(c, max_retries=2, base_seconds=0.01, model="m", messages=[])
    assert c.chat.completions.calls == 3  # 1 + 2 retries


@pytest.mark.asyncio
async def test_local_stream_chunks_join_to_answer():
    p = LocalProvider()
    q, ev, ctx = "why did revenue fall over time?", {}, {"dataset_name": "d"}
    full = (await p.interpret(q, ev, ctx))["answer"]
    assert len(full.split(" ")) > 12  # multi-chunk answer
    parts = [d async for d in p.stream_answer(q, ev, ctx)]
    assert len(parts) > 1
    assert "".join(parts) == full


def _frames(text):
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(ln.split(": ", 1) for ln in block.strip().splitlines() if ": " in ln)
        if "event" in lines:
            import json
            events.append((lines["event"], json.loads(lines.get("data", "{}"))))
    return events


@pytest.mark.asyncio
async def test_dataset_sse_shape(client):
    r = await client.post("/api/v1/auth/register",
                          json={"email": "sse1@decentra.ai", "password": "strongpass1"})
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}
    org = (await client.post("/api/v1/organizations", json={"name": "S"}, headers=H)).json()
    did = await _upload(client, H, org["id"])
    r = await client.post(f"/api/v1/datasets/{did}/assistant/query/stream",
                          json={"question": "Total revenue?"}, headers=H)
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    evs = _frames(r.text)
    kinds = [k for k, _ in evs]
    assert kinds[0] == "evidence"
    assert "token" in kinds
    assert kinds[-1] == "done"
    done = evs[-1][1]
    assert done["answer"]
    assert done["evidence"] == evs[0][1]["evidence"]


@pytest.mark.asyncio
async def test_meetings_sse_empty_org(client):
    r = await client.post("/api/v1/auth/register",
                          json={"email": "sse2@decentra.ai", "password": "strongpass1"})
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}
    org = (await client.post("/api/v1/organizations", json={"name": "S2"}, headers=H)).json()
    r = await client.post(f"/api/v1/assistant/query/stream?org_id={org['id']}",
                          json={"question": "Anything decided?"}, headers=H)
    assert r.status_code == 200
    evs = _frames(r.text)
    kinds = [k for k, _ in evs]
    assert kinds[0] == "evidence" and kinds[-1] == "done"
    assert "couldn't find evidence" in evs[-1][1]["answer"]
