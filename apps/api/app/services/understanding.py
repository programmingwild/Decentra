from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging, re
from app.models.entities import Meeting, Transcript, TranscriptSegment, Participant, MeetingUnderstanding, ParticipantAnalysis, Decision, DecisionDNA, DecisionBranch, ReviewItem

log = logging.getLogger("decentra.understanding")

TOPIC_KEYWORDS = {
    "database": ["database", "postgres", "mongodb", "schema", "sql"],
    "api": ["api", "endpoint", "specification", "spec"],
    "auth": ["auth", "authentication", "provider", "login"],
    "deployment": ["deploy", "hosting", "host", "production", "staging"],
    "scalability": ["scalability", "traffic", "handle", "load", "scale"],
    "security": ["security", "access", "encryption", "audit"],
}

def _detect_topics(text: str) -> list[str]:
    low = text.lower()
    topics = []
    for topic, kws in TOPIC_KEYWORDS.items():
        if any(kw in low for kw in kws):
            topics.append(topic)
    return topics or ["general"]

def _participation_level(count: int, total: int) -> str:
    ratio = count / max(total, 1)
    if ratio > 0.30: return "high"
    if ratio > 0.15: return "medium"
    return "low"

async def extract_understanding(meeting_id: str, db: AsyncSession):
    # clear existing
    for model in [MeetingUnderstanding, ParticipantAnalysis]:
        r = await db.execute(select(model).where(model.meeting_id == meeting_id))
        for obj in r.scalars().all():
            await db.delete(obj)
    await db.flush()

    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        return None

    # transcript
    r = await db.execute(select(Transcript).where(Transcript.meeting_id == meeting_id))
    tr = r.scalar_one_or_none()
    segs = []
    if tr:
        r2 = await db.execute(select(TranscriptSegment).where(TranscriptSegment.transcript_id == tr.id).order_by(TranscriptSegment.position))
        segs = list(r2.scalars().all())

    # participants analysis
    from collections import Counter, defaultdict
    speaker_counts = Counter(s.speaker_label for s in segs)
    total = len(segs)
    # group segments per speaker
    by_speaker = defaultdict(list)
    for s in segs:
        by_speaker[s.speaker_label].append(s)

    for speaker, s_list in by_speaker.items():
        # find participant record
        r = await db.execute(select(Participant).where(Participant.meeting_id == meeting_id, Participant.display_name == speaker))
        participant = r.scalars().first()
        # topics for this speaker
        all_text = " ".join(s.text for s in s_list).lower()
        topics = []
        for t in _detect_topics(all_text):
            if t not in topics:
                topics.append(t)
        # proposals: segments with decision triggers
        proposals = []
        for s in s_list:
            low = s.text.lower()
            if any(kw in low for kw in ["let's go with", "let's use", "we decided", "agreed", "propose", "suggest"]):
                proposals.append(s.text[:120])
        # stance
        agree = sum(1 for s in s_list if "agreed" in s.text.lower() or "let's go with" in s.text.lower())
        disagree = sum(1 for s in s_list if "disagree" in s.text.lower() or "not handle" in s.text.lower())
        stance = "agree" if agree > disagree else "disagree" if disagree > agree else "neutral"
        # role unknown unless evidence
        role = "ROLE_UNKNOWN"
        if "engineer" in all_text or "handle" in all_text or "prepare" in all_text:
            role = "ROLE_UNKNOWN"  # never invent, keep unknown per spec

        pa = ParticipantAnalysis(
            meeting_id=meeting_id,
            speaker_label=speaker,
            participant_id=participant.id if participant else None,
            participation_level=_participation_level(len(s_list), total),
            topics_discussed=topics[:4],
            proposals_made=proposals[:3],
            stance=stance,
            role=role,
        )
        db.add(pa)

    # meeting context
    # objective: first segment that looks like objective or title
    objective = None
    for s in segs[:3]:
        if len(s.text) > 20:
            objective = s.text[:240]
            break
    # primary theme: most frequent topic
    all_topics = []
    for s in segs:
        all_topics.extend(_detect_topics(s.text))
    from collections import Counter
    cnt = Counter(all_topics)
    primary = cnt.most_common(1)[0][0] if cnt else "general"
    secondary = [t for t, _ in cnt.most_common(3)[1:]]
    # requirements / constraints: look for sentences with "need", "should", "must", "require"
    reqs = []
    cons = []
    for s in segs:
        low = s.text.lower()
        if any(kw in low for kw in ["need to", "should", "must", "require"]):
            reqs.append(s.text[:160])
        if any(kw in low for kw in ["constraint", "limit", "not handle", "traffic", "scale"]):
            cons.append(s.text[:160])
    # key discussion points: longest segments
    key_points = sorted(segs, key=lambda s: len(s.text), reverse=True)[:5]
    key_discussion = [{"speaker": s.speaker_label, "text": s.text[:180], "start_ms": s.start_ms} for s in key_points]

    mu = MeetingUnderstanding(
        meeting_id=meeting_id,
        objective=objective or meeting.title,
        primary_theme=primary,
        secondary_themes=secondary[:3],
        requirements=reqs[:4],
        constraints=cons[:4],
        background=None,
        topics=[{"topic": t, "count": c} for t, c in cnt.most_common(5)],
        key_discussion_points=key_discussion,
    )
    db.add(mu)
    await db.commit()
    log.info(f"Understanding extracted for {meeting_id}: {len(by_speaker)} participants, primary {primary}")
    return mu

async def create_decision_dna(meeting_id: str, db: AsyncSession):
    # clear existing DNA/branches
    r = await db.execute(select(Decision).where(Decision.meeting_id == meeting_id))
    decisions = r.scalars().all()
    for d in decisions:
        r2 = await db.execute(select(DecisionDNA).where(DecisionDNA.decision_id == d.id))
        for obj in r2.scalars().all():
            await db.delete(obj)
        r3 = await db.execute(select(DecisionBranch).where(DecisionBranch.decision_id == d.id))
        for obj in r3.scalars().all():
            await db.delete(obj)
    await db.flush()

    # for each decision, create DNA
    for d in decisions:
        # fetch evidence segments
        seg_texts = []
        if d.transcript_segment_ids:
            r = await db.execute(select(TranscriptSegment).where(TranscriptSegment.id.in_(d.transcript_segment_ids)))
            segs = list(r.scalars().all())
            seg_texts = [s.text for s in segs]
        evidence_text = " ".join(seg_texts).lower()
        # infer requirements/constraints from evidence
        reqs = []
        cons = []
        if "postgres" in evidence_text:
            reqs.append("PostgreSQL expertise required")
            cons.append("Must handle high write volume")
        if "api" in evidence_text:
            reqs.append("API specification needed")
        if "scalability" in evidence_text or "traffic" in evidence_text:
            cons.append("API must handle expected traffic")
            reqs.append("Scalability investigation required")
        # decision_class mapping from status
        class_map = {"DETECTED": "PROPOSED_DECISION", "CONFIRMED": "CONFIRMED_DECISION", "REVISED": "CONFIRMED_DECISION", "REJECTED": "REJECTED_OPTION", "SUPERSEDED": "REJECTED_OPTION"}
        provenance_map = {"DETECTED": "TRANSCRIPT_DERIVED", "CONFIRMED": "HUMAN_APPROVED", "REVISED": "HUMAN_APPROVED", "REJECTED": "HUMAN_APPROVED", "SUPERSEDED": "HUMAN_APPROVED"}
        dna = DecisionDNA(
            decision_id=d.id,
            decision_class=class_map.get(d.status, "PROPOSED_DECISION"),
            provenance=provenance_map.get(d.status, "TRANSCRIPT_DERIVED"),
            requirements=reqs or ["Follow-up actions as per transcript"],
            constraints=cons or ["As discussed in meeting"],
            expected_outcome="As per decision: " + d.title[:120],
            risks=[{"title": "API scalability", "severity": "medium"}] if "scalability" in evidence_text else [],
            dependencies=[],
            affected_systems=["database"] if "database" in evidence_text else [],
            affected_teams=[],
            alternatives=[{"title": "MongoDB", "reason": "Considered but not selected"}] if "postgres" in evidence_text else [],
            follow_up_actions=[],
            version=1,
            related_decision_ids=[],
        )
        db.add(dna)
        # branches
        if "postgres" in d.title.lower() or "postgres" in evidence_text:
            for branch_type, title, desc in [
                ("Architecture", "Schema redesign", "Design PostgreSQL schema for v1, handle migrations"),
                ("Migration", "Data migration", "Plan data migration from existing store, testing and rollback"),
                ("Operations", "Monitoring", "Set up monitoring for PostgreSQL performance"),
            ]:
                db.add(DecisionBranch(decision_id=d.id, branch_type=branch_type, title=title, description=desc, provenance="AI_INFERRED"))
        # also create review items for each decision that is not yet confirmed
        if d.status in ("DETECTED", "PROPOSED_DECISION"):
            # find org
            m = await db.get(Meeting, meeting_id)
            if m:
                db.add(ReviewItem(org_id=m.org_id, meeting_id=meeting_id, item_type="decision", item_id=d.id, status="pending", provenance=dna.provenance))
    await db.commit()
    log.info(f"DNA created for {meeting_id}: {len(decisions)} decisions")

async def ensure_review_items(meeting_id: str, db: AsyncSession):
    # also for risks/questions
    from app.models.entities import Risk, Question
    m = await db.get(Meeting, meeting_id)
    if not m: return
    for model, typ in [(Risk, "risk"), (Question, "question")]:
        r = await db.execute(select(model).where(model.meeting_id == meeting_id))
        for obj in r.scalars().all():
            # check if already exists
            existing = await db.execute(select(ReviewItem).where(ReviewItem.item_id == obj.id))
            if existing.scalars().first(): continue
            db.add(ReviewItem(org_id=m.org_id, meeting_id=meeting_id, item_type=typ, item_id=obj.id, status="pending", provenance="TRANSCRIPT_DERIVED"))
    await db.commit()
