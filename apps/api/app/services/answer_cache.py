"""Shared answer cache for both assistants.

Correctness rules:
- Key = sha256(scope, subject id, normalized question, provider, model,
  fingerprint). Same bytes in → same answer out, across workers.
- Fingerprint captures everything the answer depends on, so new data
  invalidates precisely (no stale answers after uploads or decisions).
- TTL is only a backstop for fingerprint blind spots.
- Cache NEVER stores user identity; rows are keyed by content, safe to
  serve to any member of the same org (access is still checked first).
- Bodies are bounded (answers are KBs); expired rows pruned on write.
"""
import hashlib
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.models.entities import (ActionItem, AssistantCache, Dataset, Decision,
                                 Meeting, Question, Risk, Transcript,
                                 TranscriptSegment)

log = logging.getLogger("decentra.cache")
settings = get_settings()

_WS = re.compile(r"\s+")


def normalize_question(q: str) -> str:
    return _WS.sub(" ", (q or "").strip().lower())


def _naive_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _key(scope: str, subject_id: str, question_norm: str,
         provider: str, model: str, fingerprint: str) -> str:
    raw = "|".join([scope, subject_id, question_norm, provider, model, fingerprint])
    return hashlib.sha256(raw.encode()).hexdigest()


def dataset_fingerprint(ds: Dataset) -> str:
    """Anything that changes the answer: file bytes + row/col shape + model."""
    try:
        st = os.stat(ds.storage_path)
        file_sig = f"{st.st_mtime_ns}:{st.st_size}"
    except OSError:
        file_sig = "missing"
    return f"{file_sig}:{ds.row_count}:{ds.column_count}:{ds.updated_at}"


async def org_fingerprint(db: AsyncSession, org_id: str) -> str:
    """Newest mutation + table sizes across the org's meeting data."""
    meeting_ids = select(Meeting.id).where(Meeting.org_id == org_id)
    parts = []

    async def _max_n(model, ts_col, meeting_fk=True):
        filt = (model.meeting_id.in_(meeting_ids) if meeting_fk
                else model.org_id == org_id)
        mx = (await db.execute(select(func.max(ts_col)).where(filt))).scalar()
        n = (await db.execute(select(func.count()).select_from(model).where(filt))).scalar()
        return f"{mx}:{n}"

    parts.append(await _max_n(Meeting, Meeting.updated_at, meeting_fk=False))
    parts.append(await _max_n(Decision, Decision.created_at))
    parts.append(await _max_n(ActionItem, ActionItem.updated_at))
    parts.append(await _max_n(Question, Question.created_at))
    parts.append(await _max_n(Risk, Risk.created_at))
    nseg = (await db.execute(
        select(func.count()).select_from(TranscriptSegment)
        .join(Transcript, TranscriptSegment.transcript_id == Transcript.id)
        .join(Meeting, Transcript.meeting_id == Meeting.id)
        .where(Meeting.org_id == org_id))).scalar()
    parts.append(f"seg:{nseg}")
    return "|".join(str(p) for p in parts)


async def lookup(db: AsyncSession, *, scope: str, subject_id: str, question: str,
                 provider: str, model: str, fingerprint: str, ttl_seconds: int):
    qn = normalize_question(question)
    key = _key(scope, subject_id, qn, provider, model, fingerprint)
    row = (await db.execute(select(AssistantCache).where(AssistantCache.key_hash == key))).scalar_one_or_none()
    if row is None:
        return None
    if _strip_tz(row.expires_at) <= _naive_now():
        await db.delete(row)
        await db.commit()
        return None
    row.hits += 1
    await db.commit()
    log.info("cache hit scope=%s subject=%s hits=%d", scope, subject_id, row.hits)
    return dict(row.response, cached=True)


async def store(db: AsyncSession, *, scope: str, subject_id: str, question: str,
                provider: str, model: str, fingerprint: str, response: dict,
                ttl_seconds: int) -> None:
    qn = normalize_question(question)
    key = _key(scope, subject_id, qn, provider, model, fingerprint)
    # JSON-sanitize: evidence can carry numpy/datetime values that the DB
    # JSON column cannot store. default=str only affects the cached copy;
    # a store failure must never turn a computed answer into a 500.
    body = json.loads(json.dumps(
        {k: v for k, v in response.items() if k != "cached"}, default=str))
    row = (await db.execute(select(AssistantCache).where(AssistantCache.key_hash == key))).scalar_one_or_none()
    now = _naive_now()
    if row is None:
        row = AssistantCache(scope=scope, subject_id=subject_id, key_hash=key,
                             question_norm=qn, fingerprint=fingerprint, response=body,
                             expires_at=now + timedelta(seconds=ttl_seconds))
        db.add(row)
    else:
        row.fingerprint = fingerprint
        row.response = body
        row.expires_at = now + timedelta(seconds=ttl_seconds)
    # opportunistic prune: expired rows never accumulate
    await db.execute(delete(AssistantCache).where(AssistantCache.expires_at < now))
    await db.commit()


def _strip_tz(dt):
    return dt.replace(tzinfo=None) if getattr(dt, "tzinfo", None) else dt
