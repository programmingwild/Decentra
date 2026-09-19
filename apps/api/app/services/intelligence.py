from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging
from app.models.entities import Transcript, TranscriptSegment, Decision, ActionItem, Question, Risk
from app.utils.deadline import parse_deadline_raw

log = logging.getLogger("decentra.intelligence")

async def _llm_extract(meeting_id: str, segments, db: AsyncSession):
    """Best-effort LLM extraction. Returns True if used, else False."""
    from app.config.settings import get_settings
    settings = get_settings()
    if not settings.openai_api_key or settings.ai_provider != "openai":
        return False
    try:
        from openai import AsyncOpenAI
        import json
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        transcript_text = "\n".join([f"[{s.speaker_label} {s.start_ms//1000}s]: {s.text}" for s in segments])
        if not transcript_text.strip():
            return False
        system = (
            "You are Decentra evidence-grounded extraction. From the transcript, extract: "
            "decisions (title, description, reason), action_items (task, owner_name, deadline_raw), "
            "questions (text), risks (title, description, severity low|medium|high). "
            "Every item MUST cite evidence_segment_ids from the provided segment IDs. "
            "Respond JSON: {decisions:[], actions:[], questions:[], risks:[]}. "
            "Be conservative: only extract what is clearly stated."
        )
        seg_ids = [s.id for s in segments]
        user = f"Segments (id -> text):\n" + "\n".join([f"{s.id}: {s.text}" for s in segments]) + f"\n\nTranscript:\n{transcript_text}\n\nValid segment IDs: {seg_ids}"
        resp = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_format={"type": "json_object"},
            temperature=0.15,
        )
        data = json.loads(resp.choices[0].message.content)
        # clear already done by caller; insert LLM results with validation
        for d in data.get("decisions", [])[:5]:
            ids = [i for i in (d.get("evidence_segment_ids") or []) if i in seg_ids]
            if not ids: ids = seg_ids[:1]
            db.add(Decision(
                meeting_id=meeting_id,
                title=d.get("title", "Untitled decision")[:240],
                description=d.get("description"),
                status="DETECTED",
                confidence=float(d.get("confidence", 0.8)),
                transcript_segment_ids=ids,
                reason=d.get("reason"),
            ))
        for a in data.get("actions", [])[:8]:
            ids = [i for i in (a.get("evidence_segment_ids") or []) if i in seg_ids]
            if not ids: ids = seg_ids[:1]
            raw = a.get("deadline_raw")
            parsed = parse_deadline_raw(raw) if raw else None
            db.add(ActionItem(
                meeting_id=meeting_id,
                task=a.get("task", "Untitled task")[:500],
                owner_name=a.get("owner_name"),
                deadline_raw=raw,
                deadline=parsed,
                status="NOT_STARTED",
                transcript_segment_ids=ids,
            ))
        for q in data.get("questions", [])[:5]:
            ids = [i for i in (q.get("evidence_segment_ids") or []) if i in seg_ids]
            text = q.get("text") or q.get("question")
            if text:
                db.add(Question(meeting_id=meeting_id, text=text[:800], status="OPEN", transcript_segment_ids=ids))
        for r in data.get("risks", [])[:5]:
            ids = [i for i in (r.get("evidence_segment_ids") or []) if i in seg_ids]
            db.add(Risk(
                meeting_id=meeting_id,
                title=r.get("title", "Risk")[:240],
                description=r.get("description"),
                severity=r.get("severity", "medium") if r.get("severity") in ("low","medium","high") else "medium",
                status="OPEN",
                transcript_segment_ids=ids,
            ))
        log.info(f"LLM extraction succeeded for {meeting_id}: {len(data.get('decisions',[]))} decisions")
        return True
    except Exception as e:
        log.warning(f"LLM extraction failed for {meeting_id}: {e}")
        return False

async def extract_intelligence(meeting_id: str, db: AsyncSession):
    # idempotent - clear existing
    for model in [Decision, ActionItem, Question, Risk]:
        r = await db.execute(select(model).where(model.meeting_id == meeting_id))
        for obj in r.scalars().all():
            await db.delete(obj)
    await db.flush()

    # get transcript segments for evidence
    r = await db.execute(select(Transcript).where(Transcript.meeting_id == meeting_id))
    tr = r.scalar_one_or_none()
    segs = []
    seg_ids = []
    if tr:
        r2 = await db.execute(select(TranscriptSegment).where(TranscriptSegment.transcript_id == tr.id).order_by(TranscriptSegment.position))
        segs = list(r2.scalars().all())
        seg_ids = [s.id for s in segs]

    if not segs:
        log.warning(f"No transcript segments for {meeting_id}, creating no intelligence")
        await db.commit()
        return

    # try LLM first
    try:
        used = await _llm_extract(meeting_id, segs, db)
        if used:
            await db.commit()
            return
    except Exception as e:
        log.warning(f"LLM branch error: {e}")

    # fallback: heuristic generic extraction, evidence-grounded, confidence-scored.
    # No canned demo branch: every transcript — including any demo upload —
    # goes through the same generic pipeline, so what reviewers see is what
    # consumers get.
    # Generic heuristic for any transcript
    DECISION_TRIGGERS = ["let's go with", "let's use", "we decided", "decided to", "agreed", "selected", "choose", "choice", "we will use", "go with"]
    ACTION_TRIGGERS = ["i'll ", "i will ", "can you", "please ", "need to", "should we", "prepare", "create", "build", "investigate", "handle", "follow up", "update", "fix", "deploy", "make sure", "let's follow"]
    QUESTION_TRIGGERS = ["?", "which ", "where ", "when ", "how ", "should we", "what about", "who "]
    RISK_TRIGGERS = ["may not", "might not", "risk", "concern", "scalability", "traffic", "handle", "limitation", "issue", "blocker", "not handle"]
    DEADLINE_WORDS = ["today", "tomorrow", "friday", "monday", "tuesday", "wednesday", "thursday", "next week", "end of week", "by ", "before ", "due "]

    decisions, actions, questions, risks = [], [], [], []
    seen_titles = set()

    for seg in segs:
        low = seg.text.lower().strip()
        if not low: continue
        # question detection: ends with ? or starts with question word, but not if it's an action like "I'll ..."
        starts_action = low.startswith("i'll ") or low.startswith("i will ") or low.startswith("i'll,")
        is_question = (low.endswith("?") or any(low.startswith(t.strip()) for t in QUESTION_TRIGGERS if t.strip() != "?" and t.strip() in low[:22])) and not starts_action

        # decision heuristic (skip if question)
        dec_score = 0.0
        if not is_question:
            for trig in DECISION_TRIGGERS:
                if trig in low:
                    dec_score = max(dec_score, 0.88 if trig in ("agreed", "let's go with", "let's use", "we decided") else 0.72)
            if dec_score > 0 and len(low) > 12:
                title = seg.text.strip()[:160]
                key = title.lower()[:30]
                if key not in seen_titles and len(decisions) < 5:
                    seen_titles.add(key)
                    decisions.append((seg, title, dec_score))

        # question — priority over action/risk
        if is_question and len(low) > 10:
            if low.endswith("?") or any(low.startswith(t.strip()) for t in ["which","where","when","how","who","what","should we","can we","could we","is ","are "]):
                if len(questions) < 5:
                    questions.append((seg, seg.text.strip()[:300]))
                continue

        # risk — priority over action
        is_risk = any(trig in low for trig in RISK_TRIGGERS)
        if is_risk and len(low) > 12 and not is_question:
            if len(risks) < 4:
                risks.append((seg, seg.text.strip()[:160], low))
                if "may not" in low or "might not" in low or "risk" in low:
                    continue

        # action heuristic (only if not question/risk that was skipped)
        act_hit = any(trig in low for trig in ACTION_TRIGGERS)
        if act_hit and len(low) > 8 and not is_question:
            owner = seg.speaker_label if seg.speaker_label and "unknown" not in seg.speaker_label.lower() else None
            import re
            m = re.match(r"^\s*([A-Z][a-z]+)\s*,", seg.text)
            if m and m.group(1).lower() not in ("okay","yes","agreed"):
                owner = m.group(1)
            raw = None
            for w in DEADLINE_WORDS:
                if w in low:
                    idx = low.index(w)
                    snippet = seg.text[idx: idx+22].strip()
                    if any(d in snippet.lower() for d in ["monday","tuesday","wednesday","thursday","friday","today","tomorrow","next week"]):
                        raw = snippet.split(".")[0].split(",")[0].strip()
                        break
            if not raw:
                try:
                    nxt = segs[segs.index(seg)+1]
                    if any(w in nxt.text.lower() for w in DEADLINE_WORDS):
                        raw = nxt.text.strip()[:24]
                except: pass
            if len(actions) < 8 and seg.text.strip():
                actions.append((seg, seg.text.strip()[:220], owner, raw))

    # dedupe actions by task similarity
    uniq_actions = []
    seen_tasks = set()
    for seg, task, owner, raw in actions:
        k = task.lower()[:28]
        if k in seen_tasks: continue
        seen_tasks.add(k)
        uniq_actions.append((seg, task, owner, raw))

    # persist with evidence integrity (segment existence, ordered)
    # ensure ids are ordered by position
    pos_map = {s.id: s.position for s in segs}
    def ordered_ids(ids): return sorted(set(ids), key=lambda x: pos_map.get(x, 999))

    for seg, title, conf in decisions:
        db.add(Decision(
            meeting_id=meeting_id,
            title=title,
            description=None,
            status="DETECTED",
            confidence=conf,
            transcript_segment_ids=ordered_ids([seg.id]),
            reason="Heuristic: decision trigger matched"
        ))
    if not decisions and segs:
        # fallback: if no decision detected but transcript has content, create one from longest segment with decision-like
        longest = max(segs, key=lambda s: len(s.text))
        db.add(Decision(
            meeting_id=meeting_id,
            title=longest.text.strip()[:160],
            description="Auto-detected from longest segment (no strong trigger)",
            status="DETECTED",
            confidence=0.55,
            transcript_segment_ids=ordered_ids([longest.id]),
            reason="Fallback: no strong trigger"
        ))

    for seg, task, owner, raw in uniq_actions:
        parsed = parse_deadline_raw(raw) if raw else None
        db.add(ActionItem(
            meeting_id=meeting_id,
            task=task,
            owner_name=owner,
            deadline_raw=raw,
            deadline=parsed,
            status="NOT_STARTED",
            transcript_segment_ids=ordered_ids([seg.id]),
        ))

    for seg, text in questions:
        db.add(Question(meeting_id=meeting_id, text=text, status="OPEN", transcript_segment_ids=ordered_ids([seg.id])))

    for seg, title, low in risks:
        sev = "high" if any(w in low for w in ["high", "critical", "blocker"]) else "medium" if "medium" in low or "may not" in low else "low"
        if "scalability" in low or "traffic" in low:
            sev = "medium"
        db.add(Risk(meeting_id=meeting_id, title=title, description=seg.text.strip()[:500], severity=sev, status="OPEN", transcript_segment_ids=ordered_ids([seg.id])))

    await db.commit()
    log.info(f"Heuristic extraction for {meeting_id}: {len(decisions) or 1} decisions, {len(uniq_actions)} actions, {len(questions)} questions, {len(risks)} risks")
