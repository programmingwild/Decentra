from abc import ABC, abstractmethod
from typing import Dict, Any
import asyncio
import logging
import random

log = logging.getLogger("decentra.llm")

RETRYABLE_STATUS = {429, 500, 502, 503, 504}


def _retryable(exc) -> bool:
    """Groq free-tier queues + transient 5xx: retry these, fail fast otherwise."""
    try:
        from openai import (APIConnectionError, APIStatusError, APITimeoutError,
                            RateLimitError)
    except ImportError:
        return False
    if isinstance(exc, (RateLimitError, APITimeoutError, APIConnectionError)):
        return True
    if isinstance(exc, APIStatusError):
        return getattr(exc, "status_code", 0) in RETRYABLE_STATUS
    return False


def _retry_after(exc, default: float) -> float:
    try:
        ra = exc.response.headers.get("retry-after") if getattr(exc, "response", None) else None
        if ra:
            return min(float(ra), 30.0)
    except Exception:
        pass
    return default


async def chat_completion(client, *, max_retries: int, base_seconds: float, **kwargs):
    """chat.completions.create with exponential backoff + jitter.

    Retries ONLY transient failures (429/5xx/timeouts). Auth errors,
    bad requests, and model-not-found fail immediately — retrying those
    burns money and hides config bugs.
    """
    attempt = 0
    while True:
        try:
            return await client.chat.completions.create(**kwargs)
        except Exception as e:
            attempt += 1
            if attempt > max_retries or not _retryable(e):
                raise
            wait = _retry_after(e, base_seconds * (2 ** (attempt - 1)))
            wait = wait + random.uniform(0, 0.5)
            log.warning("LLM transient failure (%s), retry %d/%d in %.1fs",
                        type(e).__name__, attempt, max_retries, wait)
            await asyncio.sleep(wait)


def _llm_conf():
    from app.config.settings import get_settings
    s = get_settings()
    return s.llm_timeout_seconds, s.llm_max_retries, s.llm_retry_base_seconds

class AIProvider(ABC):
    @abstractmethod
    async def interpret(self, question: str, evidence: Dict[str, Any], dataset_context: Dict[str, Any]) -> Dict[str, Any]:
        """Return structured {answer, insights, evidence, recommendations, confidence}"""
        pass

    async def stream_answer(self, question: str, evidence: Dict[str, Any],
                            dataset_context: Dict[str, Any]):
        """Yield answer text deltas. Default: chunk the non-streaming answer
        (correct for LocalProvider); cloud providers override with true
        token streaming."""
        full = await self.interpret(question, evidence, dataset_context)
        text = full.get("answer", "") or ""
        for piece in _word_chunks(text):
            yield piece
            await asyncio.sleep(0)  # cancellation checkpoint


def _word_chunks(text: str, size: int = 12):
    words = text.split(" ")
    for i in range(0, len(words), size):
        yield " ".join(words[i:i + size]) + (" " if i + size < len(words) else "")


async def _sdk_token_stream(client, **kwargs):
    stream = await client.chat.completions.create(stream=True, **kwargs)
    async for chunk in stream:
        content = None
        try:
            if chunk.choices:
                content = chunk.choices[0].delta.content
        except (AttributeError, IndexError):
            content = None
        if content:
            yield content


async def _drain_with_retry(make_stream, *, max_retries: int, base_seconds: float):
    """Shared pre-token retry loop for all token streams."""
    attempt = 0
    yielded = False
    while True:
        try:
            async for delta in make_stream():
                yielded = True
                yield delta
            return
        except Exception as e:
            if yielded or attempt >= max_retries or not _retryable(e):
                raise
            attempt += 1
            wait = _retry_after(e, base_seconds * (2 ** (attempt - 1))) + random.uniform(0, 0.5)
            log.warning("LLM stream failed pre-token (%s), retry %d/%d in %.1fs",
                        type(e).__name__, attempt, max_retries, wait)
            await asyncio.sleep(wait)


async def stream_chat(client, model: str, system: str, user: str):
    """Token stream for custom prompts (meetings assistant). Retries only
    failures before the first token — once text flows, a failure ends the
    stream and the endpoint reports partial output honestly."""
    timeout, retries, base = _llm_conf()

    def make():
        return _sdk_token_stream(
            client, model=model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_format={"type": "json_object"}, temperature=0.2)

    async for delta in _drain_with_retry(make, max_retries=retries, base_seconds=base):
        yield delta


def _dataset_prompts(question, evidence, dataset_context):
    evidence_str = str(evidence)[:8000]
    ctx_str = str(dataset_context)[:2000]
    system = (
        "You are Decentra, an evidence-grounded decision intelligence assistant. "
        "You must ONLY interpret the provided evidence. Never fabricate numbers. "
        "If evidence is insufficient, say so. "
        "Respond in JSON with keys: answer (markdown), insights (list), evidence (list), recommendations (list), confidence (0-1 or null). "
        "Evidence items must reference actual values from the evidence payload."
    )
    user = f"Dataset context: {ctx_str}\n\nEvidence:\n{evidence_str}\n\nQuestion: {question}\n\nInterpret the evidence and answer. Keep recommendations cautious: use language like \"Consider investigating...\", \"Evidence suggests...\"."
    return system, user


async def cloud_token_stream(*, api_key: str, base_url: str | None, model: str,
                             system: str, user: str):
    """True token streaming for a cloud provider (Groq/OpenAI)."""
    timeout, retries, base = _llm_conf()

    def make():
        from openai import AsyncOpenAI
        kw: dict = {"api_key": api_key, "timeout": timeout}
        if base_url:
            kw["base_url"] = base_url
        client = AsyncOpenAI(**kw)
        return _sdk_token_stream(
            client, model=model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_format={"type": "json_object"}, temperature=0.2)

    async for delta in _drain_with_retry(make, max_retries=retries, base_seconds=base):
        yield delta

class LocalProvider(AIProvider):
    async def interpret(self, question: str, evidence: Dict[str, Any], dataset_context: Dict[str, Any]) -> Dict[str, Any]:
        q = question.lower()
        ds_name = dataset_context.get("dataset_name", "dataset")
        # deterministic template based on evidence keys
        if "kpis" in evidence:
            kpis = evidence["kpis"]
            if kpis:
                top = kpis[0]
                ans = f"Based on the computed KPIs for {ds_name}, **{top['name']}** is {top['value']:.2f}"
                if top.get("change_pct") is not None:
                    direction = "decreased" if top["change_pct"] < 0 else "increased"
                    ans += f" ({direction} {abs(top['change_pct']):.1f}% vs previous period)."
                else:
                    ans += "."
            else:
                ans = f"No numeric KPIs could be derived from {ds_name}."
            return {"answer": ans, "insights": [], "evidence": evidence.get("evidence_list", []), "recommendations": ["Consider investigating the primary contributors to this change."], "confidence": 0.75}

        if "anomalies" in evidence:
            anomalies = evidence["anomalies"]
            if anomalies:
                a = anomalies[0]
                ans = f"Detected {len(anomalies)} anomaly(s) in **{a.get('column')}**. Example at index {a.get('index')}: observed {a.get('value')} vs expected range {a.get('expected_min', '?'):.1f}–{a.get('expected_max', '?'):.1f} ({a.get('method')})."
                return {"answer": ans, "insights": [], "evidence": evidence.get("evidence_list", []), "recommendations": ["Prioritize reviewing records flagged as anomalous."], "confidence": 0.7}
            else:
                return {"answer": f"No anomalies detected in {ds_name} using z-score and IQR methods.", "insights": [], "evidence": [], "recommendations": [], "confidence": 0.8}

        if "forecast" in evidence:
            f = evidence["forecast"]
            if f:
                ans = f"Forecast for **{f.get('target')}** (model: {f.get('model')}) — next period predicted at {f['forecast'][0]['predicted']:.2f} (95% interval {f['forecast'][0]['lower']:.1f}–{f['forecast'][0]['upper']:.1f}). {f.get('uncertainty_note','')}"
                return {"answer": ans, "insights": [], "evidence": evidence.get("evidence_list", []), "recommendations": ["Monitor actuals vs forecast and adjust for seasonality."], "confidence": 0.65}
            return {"answer": "Insufficient time-series data to generate a reliable forecast.", "insights": [], "evidence": [], "recommendations": [], "confidence": 0.5}

        # generic
        if "why" in q or "decline" in q or "decrease" in q:
            return {"answer": f"Analysis of {ds_name} shows the change is driven by aggregated trends and segmented performance. See evidence for period-over-period comparison and segment breakdown.", "insights": [], "evidence": evidence.get("evidence_list", []), "recommendations": ["Consider investigating top contributing segments and recent anomalies."], "confidence": 0.6}
        if "best" in q or "top" in q:
            return {"answer": f"Top-performing segments were computed via GROUP BY on categorical dimensions, ordered by aggregated numeric value. See evidence.", "insights": [], "evidence": evidence.get("evidence_list", []), "recommendations": ["Prioritize reviewing underperforming segments."], "confidence": 0.7}
        return {"answer": f"Based on computed evidence for {ds_name}, see the evidence panel for metrics, trends, and segments that answer: \"{question}\"", "insights": [], "evidence": evidence.get("evidence_list", []), "recommendations": ["Explore the Analytics and Insights tabs for deeper context."], "confidence": 0.6}

class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self.api_key = api_key
        self.model = model

    async def interpret(self, question: str, evidence: Dict[str, Any], dataset_context: Dict[str, Any]) -> Dict[str, Any]:
        if not self.api_key:
            # fallback to local
            return await LocalProvider().interpret(question, evidence, dataset_context)
        try:
            from openai import AsyncOpenAI
            timeout, retries, base = _llm_conf()
            client = AsyncOpenAI(api_key=self.api_key, timeout=timeout)
            system, user = _dataset_prompts(question, evidence, dataset_context)
            resp = await chat_completion(
                client, max_retries=retries, base_seconds=base,
                model=self.model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            import json
            content = resp.choices[0].message.content
            parsed = json.loads(content)
            # validate shape
            return {
                "answer": parsed.get("answer", content),
                "insights": parsed.get("insights", []),
                "evidence": parsed.get("evidence", evidence.get("evidence_list", [])),
                "recommendations": parsed.get("recommendations", []),
                "confidence": parsed.get("confidence"),
            }
        except Exception as e:
            # graceful fallback
            fallback = await LocalProvider().interpret(question, evidence, dataset_context)
            fallback["answer"] += f"\n\n_(LLM unavailable: {str(e)[:200]})_"
            return fallback

    async def stream_answer(self, question, evidence, dataset_context):
        if not self.api_key:
            async for piece in super().stream_answer(question, evidence, dataset_context):
                yield piece
            return
        system, user = _dataset_prompts(question, evidence, dataset_context)
        async for delta in cloud_token_stream(api_key=self.api_key, base_url=None,
                                              model=self.model, system=system, user=user):
            yield delta

class GroqProvider(AIProvider):
    """Groq via its OpenAI-compatible endpoint. Same evidence-grounded
    contract as OpenAIProvider, no new dependency (uses the openai SDK)."""

    BASE_URL = "https://api.groq.com/openai/v1"

    def __init__(self, api_key: str, model: str = "openai/gpt-oss-120b"):
        self.api_key = api_key
        self.model = model

    async def interpret(self, question: str, evidence: Dict[str, Any], dataset_context: Dict[str, Any]) -> Dict[str, Any]:
        if not self.api_key:
            # fallback to local
            return await LocalProvider().interpret(question, evidence, dataset_context)
        try:
            from openai import AsyncOpenAI
            timeout, retries, base = _llm_conf()
            client = AsyncOpenAI(api_key=self.api_key, base_url=self.BASE_URL, timeout=timeout)
            system, user = _dataset_prompts(question, evidence, dataset_context)
            resp = await chat_completion(
                client, max_retries=retries, base_seconds=base,
                model=self.model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            import json
            content = resp.choices[0].message.content
            parsed = json.loads(content)
            # validate shape
            return {
                "answer": parsed.get("answer", content),
                "insights": parsed.get("insights", []),
                "evidence": parsed.get("evidence", evidence.get("evidence_list", [])),
                "recommendations": parsed.get("recommendations", []),
                "confidence": parsed.get("confidence"),
            }
        except Exception as e:
            # graceful fallback — never leak the key, only the error class
            fallback = await LocalProvider().interpret(question, evidence, dataset_context)
            fallback["answer"] += f"\n\n_(LLM unavailable: {type(e).__name__})_"
            return fallback

    async def stream_answer(self, question, evidence, dataset_context):
        if not self.api_key:
            async for piece in super().stream_answer(question, evidence, dataset_context):
                yield piece
            return
        system, user = _dataset_prompts(question, evidence, dataset_context)
        async for delta in cloud_token_stream(api_key=self.api_key, base_url=self.BASE_URL,
                                              model=self.model, system=system, user=user):
            yield delta

def build_chat_client(settings):
    """Single construction path for raw chat calls (meetings assistant).

    Returns (client, model) or (None, None) when no cloud provider is
    configured. Keys stay inside the client object — never logged.
    """
    provider = (getattr(settings, "ai_provider", "local") or "local").lower()
    timeout = getattr(settings, "llm_timeout_seconds", 25)
    if provider == "groq" and getattr(settings, "groq_api_key", ""):
        from openai import AsyncOpenAI
        return AsyncOpenAI(api_key=settings.groq_api_key, base_url=GroqProvider.BASE_URL, timeout=timeout), settings.groq_model
    if provider == "openai" and getattr(settings, "openai_api_key", ""):
        from openai import AsyncOpenAI
        return AsyncOpenAI(api_key=settings.openai_api_key, timeout=timeout), settings.openai_model
    return None, None

def get_provider(name: str, settings) -> AIProvider:
    name = (name or "local").lower()
    if name == "groq" and settings.groq_api_key:
        return GroqProvider(settings.groq_api_key, settings.groq_model)
    if name == "openai" and settings.openai_api_key:
        return OpenAIProvider(settings.openai_api_key, settings.openai_model)
    return LocalProvider()
