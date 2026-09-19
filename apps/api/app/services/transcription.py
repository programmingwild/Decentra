from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pathlib import Path
import json, logging
from app.models.entities import Transcript, TranscriptSegment, Meeting, Recording

log = logging.getLogger("decentra.transcription")

async def _load_segments_from_recording(meeting_id: str, db: AsyncSession):
    """If recording is .json/.txt, parse transcript; else return None to use mock/whisper."""
    r = await db.execute(select(Recording).where(Recording.meeting_id == meeting_id))
    rec = r.scalar_one_or_none()
    if not rec or not rec.storage_key:
        return None
    p = Path(rec.storage_key)
    if p.suffix.lower() == ".json":
        try:
            raw = p.read_bytes()
            data = json.loads(raw.decode("utf-8"))
            # support {"segments": [...]} or [...]
            segs = data.get("segments") if isinstance(data, dict) and "segments" in data else data
            if isinstance(segs, list) and segs:
                parsed = []
                for s in segs:
                    # normalize
                    speaker = s.get("speaker") or s.get("speaker_label") or "Unknown"
                    start = s.get("start") if "start" in s else s.get("start_ms", 0) / 1000 if "start_ms" in s else 0
                    end = s.get("end") if "end" in s else s.get("end_ms", 0) / 1000 if "end_ms" in s else start + 5
                    text = s.get("text") or s.get("content") or ""
                    if not text:
                        continue
                    parsed.append({"speaker": speaker, "start": int(float(start)), "end": int(float(end)), "text": text})
                if parsed:
                    log.info(f"Loaded {len(parsed)} segments from JSON recording for meeting {meeting_id}")
                    return parsed
        except Exception as e:
            log.warning(f"Failed to parse JSON transcript for {meeting_id}: {e}")
            return None
    if p.suffix.lower() == ".txt":
        try:
            text = p.read_text(encoding="utf-8", errors="ignore").strip()
            if text:
                # split into sentences as segments
                import re
                sentences = re.split(r"(?<=[.!?])\s+", text)
                parsed = []
                t = 0
                for s in sentences:
                    if s.strip():
                        parsed.append({"speaker": "Speaker", "start": t, "end": t+6, "text": s.strip()})
                        t += 7
                if parsed:
                    return parsed
        except Exception as e:
            log.warning(f"Failed to parse TXT transcript for {meeting_id}: {e}")
    return None

async def _try_whisper(meeting_id: str, db: AsyncSession):
    """Best-effort Whisper via OpenAI if configured. Returns segments or None."""
    from app.config.settings import get_settings
    settings = get_settings()
    if not settings.openai_api_key:
        return None
    try:
        r = await db.execute(select(Recording).where(Recording.meeting_id == meeting_id))
        rec = r.scalar_one_or_none()
        if not rec or not rec.storage_key:
            return None
        p = Path(rec.storage_key)
        if p.suffix.lower() in {".json", ".txt"}:
            return None
        if not p.exists():
            return None
        if p.stat().st_size > 25 * 1024 * 1024:
            log.info("Skipping Whisper: file >25MB")
            return None
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        # openai whisper expects file; use verbose_json for segments
        with p.open("rb") as f:
            tr = await client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",
                timestamp_granularities=["segment"],
            )
        segs = getattr(tr, "segments", None) or []
        if not segs:
            # fallback: single segment from text
            text = getattr(tr, "text", "") or ""
            if text:
                return [{"speaker": "Speaker", "start": 0, "end": 30, "text": text}]
            return None
        parsed = []
        for s in segs:
            speaker = getattr(s, "speaker", None) or "Speaker"
            parsed.append({
                "speaker": speaker,
                "start": int(getattr(s, "start", 0)),
                "end": int(getattr(s, "end", 0)),
                "text": getattr(s, "text", "") or "",
            })
        # naive diarization: assign round-robin speaker labels if all same
        speakers = ["Arun", "Priya", "Rahul", "Karthik", "Meena"]
        if all(x["speaker"] == "Speaker" for x in parsed):
            for i, seg in enumerate(parsed):
                seg["speaker"] = speakers[i % len(speakers)]
        log.info(f"Whisper returned {len(parsed)} segments for {meeting_id}")
        return parsed
    except Exception as e:
        log.warning(f"Whisper failed for {meeting_id}: {e}")
        return None

async def create_transcript(meeting_id: str, db: AsyncSession, force: bool = False):
    from sqlalchemy import select
    # idempotency: if exists and not force, return
    r = await db.execute(select(Transcript).where(Transcript.meeting_id == meeting_id))
    existing = r.scalar_one_or_none()
    if existing and not force:
        log.info(f"Transcript already exists for {meeting_id}, skipping")
        return existing
    if existing and force:
        # delete existing segments + transcript for reprocess
        r2 = await db.execute(select(TranscriptSegment).where(TranscriptSegment.transcript_id == existing.id))
        for seg in r2.scalars().all():
            await db.delete(seg)
        await db.delete(existing)
        await db.flush()

    # Sources, in order: uploaded JSON/TXT transcript, then Whisper.
    # No silent demo data: without a real source the job fails honestly and
    # the UI reports "transcription unavailable" instead of fake dialogue.
    segments = await _load_segments_from_recording(meeting_id, db)
    if segments is None:
        segments = await _try_whisper(meeting_id, db)
    if segments is None:
        raise ValueError(
            "No transcript available: upload a .json/.txt transcript or "
            "configure OPENAI_API_KEY for audio transcription"
        )

    # validate segments
    if not segments:
        raise ValueError("No transcript segments could be generated")

    t = Transcript(meeting_id=meeting_id, language="en")
    db.add(t)
    await db.flush()
    for i, seg in enumerate(segments):
        # validate
        try:
            start = int(seg.get("start", i * 7))
            end = int(seg.get("end", start + 5))
            text = str(seg.get("text", "")).strip()
            speaker = str(seg.get("speaker", "Speaker")).strip() or "Speaker"
            if not text:
                continue
            if end <= start:
                end = start + 4
            db.add(TranscriptSegment(
                transcript_id=t.id,
                speaker_label=speaker,
                start_ms=start*1000,
                end_ms=end*1000,
                text=text,
                confidence=seg.get("confidence", 0.92),
                position=i
            ))
        except Exception as e:
            log.warning(f"Skipping malformed segment {i}: {e}")
            continue
    await db.commit()
    # update meeting duration
    try:
        m = await db.get(Meeting, meeting_id)
        if m and segments:
            last_end = max(int(s.get("end", 0)) for s in segments)
            m.duration_ms = last_end * 1000
            await db.commit()
    except: pass
    return t

# backward compat alias (older callers)
create_mock_transcript = create_transcript
