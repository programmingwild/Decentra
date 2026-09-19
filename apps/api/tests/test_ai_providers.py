"""Groq/OpenAI provider selection, shape validation, and graceful fallback.
The chat client is stubbed — no network, no key leaves the machine.
"""
import json

import pytest

from app.ai.provider import (GroqProvider, LocalProvider, OpenAIProvider,
                             build_chat_client, get_provider)
from app.config.settings import Settings


def _settings(**kw):
    base = dict(ai_provider="local", openai_api_key="", groq_api_key="")
    base.update(kw)
    return Settings(**base)


class _Msg:
    def __init__(self, content):
        self.content = content


class _Choice:
    def __init__(self, content):
        self.message = _Msg(content)


class _Resp:
    def __init__(self, content):
        self.choices = [_Choice(content)]


class _Completions:
    def __init__(self, payload, exc):
        self.payload = payload
        self.exc = exc
        self.seen = {}

    async def create(self, **kw):
        self.seen.update(kw)
        if self.exc:
            raise self.exc
        return _Resp(json.dumps(self.payload))


class _Chat:
    def __init__(self, payload, exc):
        self.completions = _Completions(payload, exc)


class _Client:
    instances = []
    next_payload = None
    next_exc = None

    def __init__(self, **kw):
        self.kwargs = kw
        self.chat = _Chat(type(self).next_payload, type(self).next_exc)
        type(self).instances.append(self)


@pytest.fixture(autouse=True)
def _stub(monkeypatch):
    _Client.instances.clear()
    _Client.next_payload = None
    _Client.next_exc = None
    monkeypatch.setattr("openai.AsyncOpenAI", _Client)
    yield


def _payload():
    return {"answer": "Revenue fell.", "insights": ["i1"], "evidence": ["e1"],
            "recommendations": ["r1"], "confidence": 0.9}


def test_groq_selected_with_key():
    p = get_provider("groq", _settings(ai_provider="groq", groq_api_key="k"))
    assert isinstance(p, GroqProvider)


def test_groq_without_key_falls_back_local():
    assert isinstance(get_provider("groq", _settings(ai_provider="groq")), LocalProvider)


def test_openai_still_works():
    p = get_provider("openai", _settings(ai_provider="openai", openai_api_key="k"))
    assert isinstance(p, OpenAIProvider)


def test_unknown_provider_is_local():
    assert isinstance(get_provider("whatever", _settings()), LocalProvider)


@pytest.mark.asyncio
async def test_groq_interpret_shape_and_evidence():
    _Client.next_payload = _payload()
    p = GroqProvider("k", "openai/gpt-oss-120b")
    out = await p.interpret("Why?", {"evidence_list": ["fb"]}, {"dataset_name": "d"})
    assert out["answer"] == "Revenue fell."
    assert out["confidence"] == 0.9
    assert out["evidence"] == ["e1"]
    sent = _Client.instances[0].chat.completions.seen
    assert sent["model"] == "openai/gpt-oss-120b"
    assert sent["response_format"] == {"type": "json_object"}


@pytest.mark.asyncio
async def test_groq_points_at_groq_endpoint():
    _Client.next_payload = _payload()
    p = GroqProvider("k")
    await p.interpret("Why?", {}, {})
    assert _Client.instances[0].kwargs["base_url"] == GroqProvider.BASE_URL
    assert _Client.instances[0].kwargs["api_key"] == "k"


@pytest.mark.asyncio
async def test_groq_error_falls_back_without_leaking_key():
    _Client.next_exc = RuntimeError("boom gsk_leak_check")
    p = GroqProvider("super-secret-key")
    out = await p.interpret("Why down?", {"evidence_list": ["x"]}, {"dataset_name": "d"})
    assert "super-secret-key" not in out["answer"]
    assert "gsk_leak_check" not in out["answer"]
    assert "LLM unavailable" in out["answer"]


def test_build_chat_client_prefers_groq():
    c, m = build_chat_client(_settings(ai_provider="groq", groq_api_key="k",
                                       groq_model="openai/gpt-oss-120b"))
    assert m == "openai/gpt-oss-120b"
    assert c is not None


def test_build_chat_client_none_when_unconfigured():
    c, m = build_chat_client(_settings())
    assert (c, m) == (None, None)


class _Delta:
    def __init__(self, content):
        self.content = content


class _StreamChunk:
    def __init__(self, content):
        self.choices = [type("C", (), {"delta": _Delta(content)})()]


class _StreamCompletions:
    def __init__(self, pieces):
        self.pieces = list(pieces)
        self.seen_stream = None

    async def create(self, **kw):
        self.seen_stream = kw.get("stream")
        pieces = self.pieces

        async def _gen():
            for p in pieces:
                yield _StreamChunk(p)

        return _gen()


class _StreamChat:
    def __init__(self, pieces):
        self.completions = _StreamCompletions(pieces)


class _StreamClient:
    last = None

    def __init__(self, pieces, **kw):
        self.kwargs = kw
        self.chat = _StreamChat(pieces)
        type(self).last = self


@pytest.mark.asyncio
async def test_groq_true_token_streaming(monkeypatch):
    pieces = ['{"answer": "Rev', 'enue fell."}']
    monkeypatch.setattr("openai.AsyncOpenAI",
                        lambda **kw: _StreamClient(pieces, **kw))
    p = GroqProvider("k")
    out = [d async for d in p.stream_answer("Why?", {"evidence_list": []}, {"dataset_name": "d"})]
    assert "".join(out) == '{"answer": "Revenue fell."}'
    assert _StreamClient.last.chat.completions.seen_stream is True
    assert _StreamClient.last.kwargs["base_url"] == GroqProvider.BASE_URL
