from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.session import get_db, async_session
from app.auth.security import get_current_user
from app.rate_limit import limiter
from app.models.entities import User, OrganizationMember, Meeting, Participant, Project, Decision, ActionItem, Question, Risk, Transcript, TranscriptSegment, Recording, AnalysisJob, AuditLog, MeetingUnderstanding, ParticipantAnalysis, DecisionDNA, DecisionBranch, ReviewItem, Comment, ExternalResearch, Challenge, DecisionRecommendation
from app.schemas.meeting import MeetingCreate, MeetingOut, ProjectCreate, ProjectOut
from app.services.transcription import create_transcript
from app.services.intelligence import extract_intelligence
from app.services.recordings import save_recording
from app.services.understanding import extract_understanding, create_decision_dna, ensure_review_items
from app.services.privacy import Level
from app.services.tavily import external_research
from app.services.challenge import challenge_decision
from app.services.recommendation import recommend
from app.utils.deadline import parse_deadline_raw
from app.utils.search import search_candidates, tokenize
from app.utils.strength import compute_strength
import logging

log = logging.getLogger("decentra.pipeline")
ALLOWED_DECISION_STATUS = {"DETECTED", "CONFIRMED", "REVISED", "REJECTED", "SUPERSEDED"}

# Single source of truth for the decision lifecycle. Detected is not true —
# every path that mutates status (PATCH + review accept/reject/edit) must go
# through validate_decision_transition. No silent jumps, no bypasses.
DECISION_TRANSITIONS = {
    "DETECTED": {"CONFIRMED", "REVISED", "REJECTED", "SUPERSEDED"},
    "CONFIRMED": {"REVISED", "REJECTED", "SUPERSEDED", "DETECTED"},
    "REVISED": {"CONFIRMED", "REJECTED", "SUPERSEDED", "DETECTED"},
    "REJECTED": {"DETECTED"},
    "SUPERSEDED": {"DETECTED"},
}

def validate_decision_transition(old: str, new: str):
    if new != old and new not in DECISION_TRANSITIONS.get(old, set()):
        raise HTTPException(status_code=400, detail=f"Invalid transition {old} -> {new}")
ALLOWED_ACTION_STATUS = {"NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED", "OVERDUE", "CANCELLED"}
VALID_ACTION_TRANSITIONS = {
    "NOT_STARTED": {"IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED", "OVERDUE"},
    "IN_PROGRESS": {"BLOCKED", "COMPLETED", "CANCELLED", "NOT_STARTED", "OVERDUE"},
    "BLOCKED": {"IN_PROGRESS", "NOT_STARTED", "CANCELLED", "COMPLETED", "OVERDUE"},
    "COMPLETED": {"NOT_STARTED", "IN_PROGRESS"},
    "OVERDUE": {"IN_PROGRESS", "COMPLETED", "BLOCKED", "CANCELLED", "NOT_STARTED"},
    "CANCELLED": {"NOT_STARTED", "IN_PROGRESS"},
}

def _is_overdue(a):
    if not a.deadline or a.status in ("COMPLETED", "CANCELLED"):
        return False
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    dl = a.deadline
    if dl.tzinfo is None:
        dl = dl.replace(tzinfo=timezone.utc)
    return dl < now

async def _maybe_notify(db, user, meeting, action, notif_type):
    try:
        # resolve owner user_id
        owner_id = action.owner_id
        if not owner_id and action.owner_name:
            r = await db.execute(select(User).where(User.full_name.ilike(f"%{action.owner_name}%")))
            u = r.scalars().first()
            if not u:
                r = await db.execute(select(User).where(User.email.ilike(f"%{action.owner_name.split()[0].lower()}%")))
                u = r.scalars().first()
            if u:
                owner_id = u.id
        target_id = owner_id or user.id
        from app.models.entities import Notification
        # dedupe: don't create duplicate unread notification for same action+type in last hour
        from datetime import datetime, timezone, timedelta
        from sqlalchemy import and_
        recent = await db.execute(select(Notification).where(Notification.user_id == target_id, Notification.resource_id == action.id, Notification.type == notif_type, Notification.created_at > datetime.now(timezone.utc) - timedelta(hours=1)))
        if recent.scalars().first():
            return
        db.add(Notification(user_id=target_id, type=notif_type, resource_type="action", resource_id=action.id))
    except Exception as e:
        log.debug(f"notify failed: {e}")

async def _run_pipeline(meeting_id: str):
    """Background pipeline: transcribe → extract → ready/failed. Robust, idempotent, with AnalysisJob."""
    async with async_session() as db:
        try:
            m = await db.get(Meeting, meeting_id)
            if not m:
                log.error(f"Pipeline: meeting {meeting_id} not found")
                return
            # ensure job exists
            r = await db.execute(select(AnalysisJob).where(AnalysisJob.meeting_id == meeting_id, AnalysisJob.status.in_(["queued", "running"])).order_by(AnalysisJob.created_at.desc()))
            job = r.scalars().first()
            if not job:
                job = AnalysisJob(meeting_id=meeting_id, type="extract", status="running", progress=5)
                db.add(job)
                await db.flush()
            else:
                job.status = "running"
                job.progress = 10
                job.error = None
                await db.commit()
            m.status = "processing"
            await db.commit()

            # transcription (force=True to support reprocess)
            try:
                job.progress = 25
                await db.commit()
                await create_transcript(meeting_id, db, force=True)
                job.progress = 60
                await db.commit()
            except Exception as e:
                log.exception(f"Transcription failed for {meeting_id}")
                m.status = "failed"
                job.status = "failed"
                job.error = f"Transcription failed: {str(e)[:600]}"
                await db.commit()
                return

            # intelligence
            try:
                job.progress = 75
                await db.commit()
                await extract_intelligence(meeting_id, db)
            except Exception as e:
                log.exception(f"Intelligence failed for {meeting_id}")
                m.status = "failed"
                job.status = "failed"
                job.error = f"AI extraction failed: {str(e)[:600]}"
                await db.commit()
                return

            # understanding + DNA + review (non-fatal)
            try:
                job.progress = 88
                await db.commit()
                await extract_understanding(meeting_id, db)
                await create_decision_dna(meeting_id, db)
                await ensure_review_items(meeting_id, db)
            except Exception as e:
                log.warning(f"Understanding/DNA failed for {meeting_id}: {e}")

            # external research + challenge + recommendation (post-meeting only, sanitized)
            try:
                job.progress = 92
                await db.commit()
                from app.config.settings import get_settings
                settings = get_settings()
                mode = getattr(settings, "privacy_mode", "BALANCED")
                # for each decision, run research/challenge/recommend
                r = await db.execute(select(Decision).where(Decision.meeting_id == meeting_id))
                decs_for_research = r.scalars().all()
                for d in decs_for_research:
                    # fetch DNA for context
                    from app.models.entities import DecisionDNA, ExternalResearch, Challenge, DecisionRecommendation
                    r2 = await db.execute(select(DecisionDNA).where(DecisionDNA.decision_id == d.id))
                    dna = r2.scalar_one_or_none()
                    ctx = {"primary_theme": dna.requirements[0] if dna and dna.requirements else "", "requirements": dna.requirements if dna else [], "constraints": dna.constraints if dna else [], "affected_systems": dna.affected_systems if dna else []} if dna else {}
                    # research (post-meeting, not live)
                    res = await external_research(d.title, ctx, mode=mode, is_live=False)
                    # store research
                    # clear old
                    old = await db.execute(select(ExternalResearch).where(ExternalResearch.decision_id == d.id))
                    for o in old.scalars().all(): await db.delete(o)
                    db.add(ExternalResearch(decision_id=d.id, query=res.get("query"), sources=res.get("sources"), summary=res.get("summary"), status=res.get("status","unavailable")))
                    await db.flush()
                    # challenge
                    chal = await challenge_decision(d, dna, ctx, res.get("sources",[]))
                    old_c = await db.execute(select(Challenge).where(Challenge.decision_id == d.id))
                    for o in old_c.scalars().all(): await db.delete(o)
                    db.add(Challenge(decision_id=d.id, health=chal["health"], concerns=chal["concerns"], questions=chal["questions"]))
                    await db.flush()
                    # recommendation
                    rec = await recommend(d, dna, chal, res.get("sources",[]))
                    old_r = await db.execute(select(DecisionRecommendation).where(DecisionRecommendation.decision_id == d.id))
                    for o in old_r.scalars().all(): await db.delete(o)
                    db.add(DecisionRecommendation(decision_id=d.id, what=rec["what"], why=rec["why"], based_on=rec["based_on"], risks=rec["risks"], next_step=rec["next_step"], confidence=rec["confidence"], sources=rec["sources"], status=rec["status"]))
                    await db.flush()
                    # review item for recommendation if not exists
                    existing = await db.execute(select(ReviewItem).where(ReviewItem.item_id == d.id, ReviewItem.item_type == "recommendation"))
                    if not existing.scalars().first():
                        m = await db.get(Meeting, meeting_id)
                        if m:
                            db.add(ReviewItem(org_id=m.org_id, meeting_id=meeting_id, item_type="recommendation", item_id=d.id, status="pending", provenance="AI_RECOMMENDATION"))
                await db.commit()
            except Exception as e:
                log.warning(f"Research/Challenge/Recommend failed for {meeting_id}: {e}")

            m.status = "ready"
            job.status = "succeeded"
            job.progress = 100
            job.error = None
            await db.commit()
            log.info(f"Pipeline succeeded for {meeting_id}")
        except Exception as e:
            log.exception(f"Pipeline crashed for {meeting_id}")
            try:
                async with async_session() as db2:
                    m2 = await db2.get(Meeting, meeting_id)
                    if m2:
                        m2.status = "failed"
                        await db2.commit()
                    r2 = await db2.execute(select(AnalysisJob).where(AnalysisJob.meeting_id == meeting_id, AnalysisJob.status == "running").order_by(AnalysisJob.created_at.desc()))
                    j2 = r2.scalars().first()
                    if j2:
                        j2.status = "failed"
                        j2.error = f"Pipeline crashed: {str(e)[:600]}"
                        await db2.commit()
            except Exception:
                pass

router = APIRouter(prefix="/api/v1", tags=["meetings"])

async def require_org_member(org_id: str, user: User, db: AsyncSession):
    r = await db.execute(select(OrganizationMember).where(OrganizationMember.org_id == org_id, OrganizationMember.user_id == user.id))
    if not r.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of organization")
    return True

ROLE_RANK = {"VIEWER": 0, "ANALYST": 1, "MANAGER": 2, "ADMIN": 3}

async def get_user_role(org_id: str, user: User, db: AsyncSession) -> str:
    r = await db.execute(select(OrganizationMember).where(OrganizationMember.org_id == org_id, OrganizationMember.user_id == user.id))
    row = r.scalar_one_or_none()
    return row.role if row else "VIEWER"

async def require_role(org_id: str, user: User, db: AsyncSession, min_role: str = "ANALYST"):
    role = await get_user_role(org_id, user, db)
    if ROLE_RANK.get(role, 0) < ROLE_RANK.get(min_role, 1):
        raise HTTPException(status_code=403, detail=f"Requires {min_role} role (you are {role})")
    return role

def parse_mentions(text: str) -> list[str]:
    import re
    # capture @email or @name
    return re.findall(r"@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[A-Za-z0-9_]+)", text)

@router.post("/projects", response_model=ProjectOut)
async def create_project(body: ProjectCreate, org_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    p = Project(org_id=org_id, name=body.name, description=body.description, created_by=user.id)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return ProjectOut(id=p.id, org_id=p.org_id, name=p.name, description=p.description, created_at=p.created_at)

@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(org_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    r = await db.execute(select(Project).where(Project.org_id == org_id).order_by(Project.created_at.desc()))
    return [ProjectOut(id=p.id, org_id=p.org_id, name=p.name, description=p.description, created_at=p.created_at) for p in r.scalars().all()]

@router.post("/meetings", response_model=MeetingOut)
async def create_meeting(body: MeetingCreate, org_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    if body.project_id:
        proj = await db.get(Project, body.project_id)
        if not proj or proj.org_id != org_id:
            raise HTTPException(status_code=400, detail="Invalid project")
    m = Meeting(org_id=org_id, title=body.title, date=body.date, project_id=body.project_id, created_by=user.id, status="draft")
    db.add(m)
    await db.flush()
    # participants
    emails = body.participant_emails or []
    names = body.participant_names or []
    for i, email in enumerate(emails):
        name = names[i] if i < len(names) else email.split("@")[0]
        db.add(Participant(meeting_id=m.id, display_name=name, email=email))
    # add creator as participant if not already in list
    if not any(e == user.email for e in emails):
        db.add(Participant(meeting_id=m.id, user_id=user.id, display_name=user.full_name or user.email.split("@")[0], email=user.email))
        participant_count = len(emails) + 1
    else:
        participant_count = len(emails)
    await db.commit()
    await db.refresh(m)
    return MeetingOut(id=m.id, org_id=m.org_id, project_id=m.project_id, title=m.title, date=m.date, status=m.status, created_by=m.created_by, created_at=m.created_at, participant_count=participant_count)

@router.get("/meetings", response_model=list[MeetingOut])
async def list_meetings(org_id: str, project_id: str = None, status: str = None, q: str = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    query = select(Meeting).where(Meeting.org_id == org_id)
    if project_id:
        query = query.where(Meeting.project_id == project_id)
    if status:
        query = query.where(Meeting.status == status)
    if q:
        query = query.where(Meeting.title.ilike(f"%{q}%"))
    query = query.order_by(Meeting.date.desc())
    r = await db.execute(query)
    meetings = r.scalars().all()
    out = []
    for m in meetings:
        cnt = await db.execute(select(func.count()).select_from(Participant).where(Participant.meeting_id == m.id))
        pcount = cnt.scalar() or 0
        dcnt = await db.execute(select(func.count()).select_from(Decision).where(Decision.meeting_id == m.id))
        acnt = await db.execute(select(func.count()).select_from(ActionItem).where(ActionItem.meeting_id == m.id))
        out.append(MeetingOut(id=m.id, org_id=m.org_id, project_id=m.project_id, title=m.title, date=m.date, duration_ms=m.duration_ms, status=m.status, created_by=m.created_by, created_at=m.created_at, participant_count=pcount, decisions_count=dcnt.scalar() or 0, actions_count=acnt.scalar() or 0))
    return out

@router.get("/meetings/{meeting_id}", response_model=MeetingOut)
async def get_meeting(meeting_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    cnt = await db.execute(select(func.count()).select_from(Participant).where(Participant.meeting_id == m.id))
    dcnt = await db.execute(select(func.count()).select_from(Decision).where(Decision.meeting_id == m.id))
    acnt = await db.execute(select(func.count()).select_from(ActionItem).where(ActionItem.meeting_id == m.id))
    return MeetingOut(id=m.id, org_id=m.org_id, project_id=m.project_id, title=m.title, date=m.date, duration_ms=m.duration_ms, status=m.status, created_by=m.created_by, created_at=m.created_at, participant_count=cnt.scalar() or 0, decisions_count=dcnt.scalar() or 0, actions_count=acnt.scalar() or 0)

@router.post("/meetings/{meeting_id}/recording")
async def upload_recording(meeting_id: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    from app.config.settings import get_settings as _gs
    from app.utils.uploads import read_upload_capped as _capped
    try:
        data = await _capped(file, _gs().max_recording_mb * 1024 * 1024, label="Recording")
    except ValueError as e:
        raise HTTPException(status_code=413, detail=str(e))
    try:
        key = save_recording(data, file.filename or "recording.webm", meeting_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        log.exception(f"Failed to save recording for meeting {meeting_id}")
        raise HTTPException(status_code=500, detail="Failed to save recording")
    # upsert recording
    try:
        r = await db.execute(select(Recording).where(Recording.meeting_id == meeting_id))
        rec = r.scalar_one_or_none()
        if rec:
            rec.storage_key = key
            rec.mime_type = file.content_type
            rec.size_bytes = len(data)
        else:
            db.add(Recording(meeting_id=meeting_id, storage_key=key, mime_type=file.content_type, size_bytes=len(data)))
        m.status = "processing"
        await db.commit()
    except Exception:
        log.exception(f"Recording DB upsert failed for meeting {meeting_id}")
        raise HTTPException(status_code=500, detail="Failed to save recording")
    return {"storage_key": key, "status": m.status}

@router.post("/meetings/{meeting_id}/process")
async def process_meeting(meeting_id: str, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    # idempotency: if already processing, return 202 with status
    if m.status == "processing":
        r = await db.execute(select(AnalysisJob).where(AnalysisJob.meeting_id == meeting_id, AnalysisJob.status.in_(["queued", "running"])).order_by(AnalysisJob.created_at.desc()))
        j = r.scalars().first()
        if j and j.status in ("queued", "running"):
            return {"status": "processing", "job_id": j.id}
        # stale processing (no running job) — allow reprocess below
    # create job queued
    job = AnalysisJob(meeting_id=meeting_id, type="extract", status="queued", progress=0)
    db.add(job)
    m.status = "processing"
    await db.commit()
    await db.refresh(job)
    background_tasks.add_task(_run_pipeline, meeting_id)
    return {"status": "processing", "job_id": job.id}

@router.get("/meetings/{meeting_id}/status")
async def get_meeting_status(meeting_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    r = await db.execute(select(AnalysisJob).where(AnalysisJob.meeting_id == meeting_id).order_by(AnalysisJob.created_at.desc()))
    jobs = r.scalars().all()
    latest = jobs[0] if jobs else None
    return {
        "meeting_id": meeting_id,
        "status": m.status,
        "job": {"id": latest.id, "status": latest.status, "progress": latest.progress, "error": latest.error} if latest else None,
        "jobs": [{"id": j.id, "type": j.type, "status": j.status, "progress": j.progress, "error": j.error, "created_at": j.created_at} for j in jobs[:5]],
    }

@router.get("/meetings/{meeting_id}/transcript")
async def get_transcript(meeting_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    r = await db.execute(select(Transcript).where(Transcript.meeting_id == meeting_id))
    tr = r.scalar_one_or_none()
    if not tr:
        return {"segments": []}
    r2 = await db.execute(select(TranscriptSegment).where(TranscriptSegment.transcript_id == tr.id).order_by(TranscriptSegment.position))
    segs = r2.scalars().all()
    return {"transcript_id": tr.id, "segments": [{"id": s.id, "speaker_label": s.speaker_label, "start_ms": s.start_ms, "end_ms": s.end_ms, "text": s.text, "confidence": s.confidence} for s in segs]}

@router.get("/meetings/{meeting_id}/intelligence")
async def get_intelligence(meeting_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    dec = (await db.execute(select(Decision).where(Decision.meeting_id == meeting_id))).scalars().all()
    acts = (await db.execute(select(ActionItem).where(ActionItem.meeting_id == meeting_id))).scalars().all()
    qs = (await db.execute(select(Question).where(Question.meeting_id == meeting_id))).scalars().all()
    risks = (await db.execute(select(Risk).where(Risk.meeting_id == meeting_id))).scalars().all()
    # strength requires segments
    r = await db.execute(select(Transcript).where(Transcript.meeting_id == meeting_id))
    tr = r.scalar_one_or_none()
    segs = []
    if tr:
        r2 = await db.execute(select(TranscriptSegment).where(TranscriptSegment.transcript_id == tr.id))
        segs = list(r2.scalars().all())
    return {
        "decisions": [{"id": d.id, "title": d.title, "description": d.description, "status": d.status, "confidence": d.confidence, "evidence_segment_ids": d.transcript_segment_ids, "strength": compute_strength(d, segs)} for d in dec],
        "actions": [{"id": a.id, "task": a.task, "owner_name": a.owner_name, "deadline_raw": a.deadline_raw, "deadline": a.deadline, "status": a.status, "evidence_segment_ids": a.transcript_segment_ids, "overdue": _is_overdue(a)} for a in acts],
        "questions": [{"id": q.id, "text": q.text, "status": q.status, "evidence_segment_ids": q.transcript_segment_ids} for q in qs],
        "risks": [{"id": r.id, "title": r.title, "description": r.description, "severity": r.severity, "status": r.status, "evidence_segment_ids": r.transcript_segment_ids} for r in risks],
    }

@router.patch("/decisions/{decision_id}")
async def update_decision(decision_id: str, body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    d = await db.get(Decision, decision_id)
    if not d:
        raise HTTPException(status_code=404, detail="Decision not found")
    m = await db.get(Meeting, d.meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    await require_role(m.org_id, user, db, "ANALYST")
    old_status = d.status
    if "status" in body:
        st = body["status"]
        if st not in ALLOWED_DECISION_STATUS:
            raise HTTPException(status_code=400, detail=f"Invalid decision status '{st}'. Allowed: {', '.join(sorted(ALLOWED_DECISION_STATUS))}")
        # validate state machine (single source of truth — see DECISION_TRANSITIONS)
        validate_decision_transition(old_status, st)
        d.status = st
        if st in ("CONFIRMED", "REVISED"):
            from datetime import datetime, timezone
            d.confirmed_at = datetime.now(timezone.utc)
        # auto-supersede duplicates: when confirming, supersede other DETECTED with same title prefix.
        # Each supersede is audited — silent status flips are a provenance hole.
        if st in ("CONFIRMED", "REVISED"):
            r = await db.execute(select(Decision).where(Decision.meeting_id == d.meeting_id, Decision.id != d.id, Decision.status == "DETECTED"))
            for other in r.scalars().all():
                if other.title.lower()[:30] == d.title.lower()[:30]:
                    other.status = "SUPERSEDED"
                    try:
                        db.add(AuditLog(org_id=m.org_id, actor_user_id=user.id, action="decision.superseded", resource_type="decision", resource_id=other.id, meta={"superseded_by": d.id, "title": other.title}))
                    except Exception as e:
                        log.warning(f"audit write failed (decision.superseded {other.id}): {e}")
    if "title" in body:
        title = str(body["title"]).strip()
        if not title:
            raise HTTPException(status_code=400, detail="Decision title cannot be empty")
        if len(title) > 500:
            raise HTTPException(status_code=400, detail="Decision title too long (max 500)")
        d.title = title
    if "description" in body and body["description"] is not None:
        d.description = str(body["description"])[:2000]
    if "transcript_segment_ids" in body and body["transcript_segment_ids"] is not None:
        ids = body["transcript_segment_ids"]
        if not isinstance(ids, list):
            raise HTTPException(status_code=400, detail="transcript_segment_ids must be a list")
        # validate existence and ordering
        if ids:
            r = await db.execute(select(TranscriptSegment.id).where(TranscriptSegment.id.in_(ids)))
            found = set(x for (x,) in r.all())
            invalid = [i for i in ids if i not in found]
            if invalid:
                raise HTTPException(status_code=400, detail=f"Invalid segment ids: {invalid[:3]}")
            # ensure they belong to this meeting's transcript
            # order by position
            r2 = await db.execute(select(TranscriptSegment).where(TranscriptSegment.id.in_(ids)))
            segs = list(r2.scalars().all())
            # verify all belong to same meeting transcript
            tr_ids = set(s.transcript_id for s in segs)
            r3 = await db.execute(select(Transcript).where(Transcript.id.in_(tr_ids), Transcript.meeting_id == d.meeting_id))
            if r3.scalars().first() is None and ids:
                raise HTTPException(status_code=400, detail="Evidence segments do not belong to this meeting")
            # dedup + order by position
            pos = {s.id: s.position for s in segs}
            d.transcript_segment_ids = sorted(set(ids), key=lambda x: pos.get(x, 999))
        else:
            d.transcript_segment_ids = []
    # audit (failures are logged, never silent — provenance depends on this row)
    try:
        db.add(AuditLog(org_id=m.org_id, actor_user_id=user.id, action=f"decision.{d.status.lower()}", resource_type="decision", resource_id=d.id, meta={"old_status": old_status, "new_status": d.status, "title": d.title}))
    except Exception as e:
        log.warning(f"audit write failed (decision.{d.status.lower()} {d.id}): {e}")
    await db.commit()
    return {"id": d.id, "status": d.status, "title": d.title}

@router.patch("/actions/{action_id}")
async def update_action(action_id: str, body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    a = await db.get(ActionItem, action_id)
    if not a:
        raise HTTPException(status_code=404, detail="Action not found")
    m = await db.get(Meeting, a.meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    await require_role(m.org_id, user, db, "ANALYST")
    old_status = a.status
    old_owner = a.owner_name
    old_deadline_raw = a.deadline_raw
    if "status" in body:
        st = body["status"]
        if st not in ALLOWED_ACTION_STATUS:
            raise HTTPException(status_code=400, detail=f"Invalid action status '{st}'. Allowed: {', '.join(sorted(ALLOWED_ACTION_STATUS))}")
        if st != old_status and st not in VALID_ACTION_TRANSITIONS.get(old_status, set()):
            raise HTTPException(status_code=400, detail=f"Invalid transition {old_status} -> {st}")
        a.status = st
    if "owner_name" in body:
        v = body["owner_name"]
        if v is not None:
            v = str(v).strip()
            if len(v) > 120:
                raise HTTPException(status_code=400, detail="Owner name too long")
            a.owner_name = v if v else None
            # try to resolve owner_id if email-like? keep simple
        else:
            a.owner_name = None
            a.owner_id = None
    if "deadline_raw" in body:
        v = body["deadline_raw"]
        if v is not None:
            v = str(v).strip()
            a.deadline_raw = v if v else None
            a.deadline = parse_deadline_raw(v) if v else None
        else:
            a.deadline_raw = None
            a.deadline = None
    # support direct deadline ISO update
    if "deadline" in body and body["deadline"]:
        try:
            a.deadline = parse_deadline_raw(str(body["deadline"]))
        except: pass
    if "transcript_segment_ids" in body and body["transcript_segment_ids"] is not None:
        ids = body["transcript_segment_ids"]
        if not isinstance(ids, list):
            raise HTTPException(status_code=400, detail="transcript_segment_ids must be a list")
        if ids:
            r = await db.execute(select(TranscriptSegment.id).where(TranscriptSegment.id.in_(ids)))
            found = set(x for (x,) in r.all())
            invalid = [i for i in ids if i not in found]
            if invalid:
                raise HTTPException(status_code=400, detail=f"Invalid segment ids: {invalid[:3]}")
            r2 = await db.execute(select(TranscriptSegment).where(TranscriptSegment.id.in_(ids)))
            segs = list(r2.scalars().all())
            tr_ids = set(s.transcript_id for s in segs)
            r3 = await db.execute(select(Transcript).where(Transcript.id.in_(tr_ids), Transcript.meeting_id == a.meeting_id))
            if r3.scalars().first() is None and ids:
                raise HTTPException(status_code=400, detail="Evidence segments do not belong to this meeting")
            pos = {s.id: s.position for s in segs}
            a.transcript_segment_ids = sorted(set(ids), key=lambda x: pos.get(x, 999))
        else:
            a.transcript_segment_ids = []
    if "task" in body and body["task"] is not None:
        task = str(body["task"]).strip()
        if not task:
            raise HTTPException(status_code=400, detail="Task cannot be empty")
        if len(task) > 500:
            raise HTTPException(status_code=400, detail="Task too long (max 500)")
        a.task = task
    from datetime import datetime, timezone
    a.updated_at = datetime.now(timezone.utc)
    # notifications
    try:
        if old_owner != a.owner_name and a.owner_name:
            await _maybe_notify(db, user, m, a, "assigned")
        if old_deadline_raw != a.deadline_raw and a.deadline:
            if _is_overdue(a):
                await _maybe_notify(db, user, m, a, "overdue")
            else:
                # due soon check (within 2 days)
                now = datetime.now(timezone.utc)
                dl = a.deadline
                if dl.tzinfo is None: dl = dl.replace(tzinfo=timezone.utc)
                if 0 <= (dl - now).days <= 2 and a.status not in ("COMPLETED","CANCELLED"):
                    await _maybe_notify(db, user, m, a, "due_soon")
        if old_status != a.status and a.status == "COMPLETED":
            await _maybe_notify(db, user, m, a, "completed")
        if not a.owner_name and a.status not in ("COMPLETED","CANCELLED"):
            await _maybe_notify(db, user, m, a, "unassigned")
    except: pass
    # audit (failures are logged, never silent)
    try:
        db.add(AuditLog(org_id=m.org_id, actor_user_id=user.id, action=f"action.{a.status.lower()}", resource_type="action", resource_id=a.id, meta={"old_status": old_status, "new_status": a.status, "task": a.task, "owner": a.owner_name}))
    except Exception as e:
        log.warning(f"audit write failed (action.{a.status.lower()} {a.id}): {e}")
    await db.commit()
    return {"id": a.id, "status": a.status, "owner_name": a.owner_name, "deadline_raw": a.deadline_raw, "deadline": a.deadline, "overdue": _is_overdue(a)}

@router.get("/decisions")
async def list_decisions(org_id: str, status: str = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    q = select(Decision).join(Meeting, Decision.meeting_id == Meeting.id).where(Meeting.org_id == org_id)
    if status:
        q = q.where(Decision.status == status)
    r = await db.execute(q.order_by(Decision.created_at.desc()))
    return [{"id": d.id, "title": d.title, "description": d.description, "status": d.status, "confidence": d.confidence, "meeting_id": d.meeting_id, "evidence_segment_ids": d.transcript_segment_ids} for d in r.scalars().all()]

@router.get("/actions")
async def list_actions(org_id: str, status: str = None, owner: str = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    q = select(ActionItem).join(Meeting, ActionItem.meeting_id == Meeting.id).where(Meeting.org_id == org_id)
    if status:
        q = q.where(ActionItem.status == status)
    if owner == "me":
        q = q.where((ActionItem.owner_name.ilike(f"%{user.full_name or user.email.split('@')[0]}%")) | (ActionItem.owner_id == user.id))
    r = await db.execute(q.order_by(ActionItem.created_at.desc()))
    out = []
    for a in r.scalars().all():
        out.append({"id": a.id, "task": a.task, "owner_name": a.owner_name, "status": a.status, "meeting_id": a.meeting_id, "deadline_raw": a.deadline_raw, "deadline": a.deadline, "evidence_segment_ids": a.transcript_segment_ids, "overdue": _is_overdue(a)})
    return out

@router.get("/notifications")
async def list_notifications(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.entities import Notification
    r = await db.execute(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(50))
    notifs = r.scalars().all()
    return [{"id": n.id, "type": n.type, "resource_type": n.resource_type, "resource_id": n.resource_id, "read_at": n.read_at, "created_at": n.created_at} for n in notifs]

@router.post("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.entities import Notification
    n = await db.get(Notification, notif_id)
    if not n or n.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    from datetime import datetime, timezone
    n.read_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": n.id, "read_at": n.read_at}

@router.get("/audit")
async def list_audit(org_id: str, resource_type: str = None, resource_id: str = None, limit: int = 50, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    q = select(AuditLog).where(AuditLog.org_id == org_id).order_by(AuditLog.created_at.desc()).limit(min(limit, 100))
    if resource_type:
        q = q.where(AuditLog.resource_type == resource_type)
    if resource_id:
        q = q.where(AuditLog.resource_id == resource_id)
    r = await db.execute(q)
    logs = r.scalars().all()
    return [{"id": l.id, "actor_user_id": l.actor_user_id, "action": l.action, "resource_type": l.resource_type, "resource_id": l.resource_id, "meta": l.meta, "created_at": l.created_at} for l in logs]

@router.get("/meetings/{meeting_id}/comments")
async def list_comments(meeting_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(Meeting, meeting_id)
    if not m: raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    from app.models.entities import Comment
    r = await db.execute(select(Comment).where(Comment.meeting_id == meeting_id).order_by(Comment.created_at.asc()))
    comments = r.scalars().all()
    # include author info
    out = []
    for c in comments:
        author = await db.get(User, c.author_user_id) if c.author_user_id else None
        out.append({"id": c.id, "meeting_id": c.meeting_id, "author_user_id": c.author_user_id, "author_name": c.author_name or (author.full_name if author else "Unknown"), "author_email": author.email if author else None, "text": c.text, "parent_id": c.parent_id, "mentions": c.mentions, "created_at": c.created_at})
    return out

@router.post("/meetings/{meeting_id}/comments")
async def create_comment(meeting_id: str, body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(Meeting, meeting_id)
    if not m: raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    await require_role(m.org_id, user, db, "ANALYST")
    text = (body.get("text") or "").strip()
    if not text: raise HTTPException(status_code=400, detail="Comment text required")
    if len(text) > 2000: raise HTTPException(status_code=400, detail="Comment too long (max 2000)")
    parent_id = body.get("parent_id")
    if parent_id:
        from app.models.entities import Comment
        p = await db.get(Comment, parent_id)
        if not p or p.meeting_id != meeting_id:
            raise HTTPException(status_code=400, detail="Invalid parent comment")
    mentions_raw = parse_mentions(text)
    mention_ids = []
    for mtn in mentions_raw:
        # try email lookup
        r = await db.execute(select(User).where(User.email.ilike(mtn)))
        u = r.scalars().first()
        if not u:
            r = await db.execute(select(User).where(User.full_name.ilike(f"%{mtn}%")))
            u = r.scalars().first()
        if u:
            mention_ids.append(u.id)
            # notify
            from app.models.entities import Notification
            try:
                db.add(Notification(user_id=u.id, type="mention", resource_type="comment", resource_id=meeting_id))
            except: pass
    from app.models.entities import Comment
    c = Comment(meeting_id=meeting_id, author_user_id=user.id, author_name=user.full_name or user.email.split("@")[0], text=text, parent_id=parent_id, mentions=mention_ids)
    db.add(c)
    # audit
    try:
        db.add(AuditLog(org_id=m.org_id, actor_user_id=user.id, action="comment.create", resource_type="comment", resource_id=c.id, meta={"meeting_id": meeting_id, "text": text[:120]}))
    except: pass
    await db.commit()
    await db.refresh(c)
    return {"id": c.id, "text": c.text, "author_name": c.author_name, "mentions": mention_ids, "created_at": c.created_at}

@router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.entities import Comment
    c = await db.get(Comment, comment_id)
    if not c: raise HTTPException(status_code=404, detail="Comment not found")
    m = await db.get(Meeting, c.meeting_id)
    if not m: raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    # only author or ADMIN can delete
    role = await get_user_role(m.org_id, user, db)
    if c.author_user_id != user.id and ROLE_RANK.get(role, 0) < ROLE_RANK["MANAGER"]:
        raise HTTPException(status_code=403, detail="Only author or manager can delete")
    await db.delete(c)
    try:
        db.add(AuditLog(org_id=m.org_id, actor_user_id=user.id, action="comment.delete", resource_type="comment", resource_id=comment_id, meta={}))
    except: pass
    await db.commit()
    return {"deleted": True}

@router.get("/meetings/{meeting_id}/activity")
async def get_activity(meeting_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(Meeting, meeting_id)
    if not m: raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    from app.models.entities import Comment
    # comments
    r = await db.execute(select(Comment).where(Comment.meeting_id == meeting_id).order_by(Comment.created_at.desc()).limit(20))
    comments = r.scalars().all()
    # audit for this meeting's resources
    # get decision/action ids for this meeting
    r1 = await db.execute(select(Decision.id).where(Decision.meeting_id == meeting_id))
    dec_ids = [x for (x,) in r1.all()]
    r2 = await db.execute(select(ActionItem.id).where(ActionItem.meeting_id == meeting_id))
    act_ids = [x for (x,) in r2.all()]
    all_ids = set(dec_ids + act_ids + [meeting_id])
    # also include comments
    r3 = await db.execute(select(AuditLog).where(AuditLog.org_id == m.org_id, AuditLog.created_at > m.created_at).order_by(AuditLog.created_at.desc()).limit(50))
    logs = [l for l in r3.scalars().all() if l.resource_id in all_ids or l.resource_type in ("meeting","comment")]
    # if not filtered, at least show recent for meeting
    if not logs:
        r4 = await db.execute(select(AuditLog).where(AuditLog.org_id == m.org_id).order_by(AuditLog.created_at.desc()).limit(10))
        logs = r4.scalars().all()
    return {
        "comments": [{"id": c.id, "author_name": c.author_name, "author_user_id": c.author_user_id, "text": c.text, "parent_id": c.parent_id, "mentions": c.mentions, "created_at": c.created_at} for c in comments],
        "audit": [{"id": l.id, "action": l.action, "resource_type": l.resource_type, "resource_id": l.resource_id, "meta": l.meta, "actor_user_id": l.actor_user_id, "created_at": l.created_at} for l in logs[:12]],
    }

@router.get("/meetings/{meeting_id}/understanding")
async def get_understanding(meeting_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(Meeting, meeting_id)
    if not m: raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    from app.models.entities import MeetingUnderstanding, ParticipantAnalysis
    r = await db.execute(select(MeetingUnderstanding).where(MeetingUnderstanding.meeting_id == meeting_id))
    mu = r.scalar_one_or_none()
    if not mu:
        return {"meeting_id": meeting_id, "understanding": None, "participants": []}
    r2 = await db.execute(select(ParticipantAnalysis).where(ParticipantAnalysis.meeting_id == meeting_id).order_by(ParticipantAnalysis.speaker_label))
    pas = r2.scalars().all()
    return {
        "meeting_id": meeting_id,
        "understanding": {"objective": mu.objective, "primary_theme": mu.primary_theme, "secondary_themes": mu.secondary_themes, "requirements": mu.requirements, "constraints": mu.constraints, "topics": mu.topics, "key_discussion_points": mu.key_discussion_points, "created_at": mu.created_at},
        "participants": [{"speaker_label": p.speaker_label, "participation_level": p.participation_level, "topics_discussed": p.topics_discussed, "proposals_made": p.proposals_made, "stance": p.stance, "role": p.role} for p in pas],
    }

@router.get("/decisions/{decision_id}/dna")
async def get_dna(decision_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.entities import DecisionDNA, DecisionBranch
    d = await db.get(Decision, decision_id)
    if not d: raise HTTPException(status_code=404, detail="Decision not found")
    m = await db.get(Meeting, d.meeting_id)
    await require_org_member(m.org_id, user, db)
    r = await db.execute(select(DecisionDNA).where(DecisionDNA.decision_id == decision_id))
    dna = r.scalar_one_or_none()
    r2 = await db.execute(select(DecisionBranch).where(DecisionBranch.decision_id == decision_id))
    branches = r2.scalars().all()
    if not dna:
        return {"decision_id": decision_id, "dna": None, "branches": []}
    return {
        "decision_id": decision_id,
        "dna": {"decision_class": dna.decision_class, "provenance": dna.provenance, "requirements": dna.requirements, "constraints": dna.constraints, "expected_outcome": dna.expected_outcome, "risks": dna.risks, "dependencies": dna.dependencies, "affected_systems": dna.affected_systems, "affected_teams": dna.affected_teams, "alternatives": dna.alternatives, "follow_up_actions": dna.follow_up_actions, "version": dna.version},
        "branches": [{"id": b.id, "branch_type": b.branch_type, "title": b.title, "description": b.description, "provenance": b.provenance} for b in branches],
    }

@router.get("/decisions/{decision_id}/research")
async def get_research(decision_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.entities import ExternalResearch
    d = await db.get(Decision, decision_id)
    if not d: raise HTTPException(status_code=404, detail="Decision not found")
    m = await db.get(Meeting, d.meeting_id)
    await require_org_member(m.org_id, user, db)
    r = await db.execute(select(ExternalResearch).where(ExternalResearch.decision_id == decision_id).order_by(ExternalResearch.created_at.desc()).limit(1))
    rec = r.scalars().first()
    if not rec:
        return {"decision_id": decision_id, "research": None}
    return {"decision_id": decision_id, "research": {"query": rec.query, "sources": rec.sources, "summary": rec.summary, "status": rec.status, "created_at": rec.created_at}}

@router.get("/decisions/{decision_id}/challenge")
async def get_challenge(decision_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.entities import Challenge
    d = await db.get(Decision, decision_id)
    if not d: raise HTTPException(status_code=404, detail="Decision not found")
    m = await db.get(Meeting, d.meeting_id)
    await require_org_member(m.org_id, user, db)
    r = await db.execute(select(Challenge).where(Challenge.decision_id == decision_id).order_by(Challenge.created_at.desc()).limit(1))
    c = r.scalars().first()
    if not c:
        return {"decision_id": decision_id, "challenge": None}
    return {"decision_id": decision_id, "challenge": {"health": c.health, "concerns": c.concerns, "questions": c.questions, "created_at": c.created_at}}

@router.get("/decisions/{decision_id}/recommendation")
async def get_recommendation(decision_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.entities import DecisionRecommendation
    d = await db.get(Decision, decision_id)
    if not d: raise HTTPException(status_code=404, detail="Decision not found")
    m = await db.get(Meeting, d.meeting_id)
    await require_org_member(m.org_id, user, db)
    r = await db.execute(select(DecisionRecommendation).where(DecisionRecommendation.decision_id == decision_id).order_by(Recommendation.created_at.desc()).limit(1))
    rec = r.scalars().first()
    if not rec:
        return {"decision_id": decision_id, "recommendation": None}
    return {"decision_id": decision_id, "recommendation": {"what": rec.what, "why": rec.why, "based_on": rec.based_on, "risks": rec.risks, "next_step": rec.next_step, "confidence": rec.confidence, "sources": rec.sources, "status": rec.status, "created_at": rec.created_at}}

@router.get("/review_queue")
async def review_queue(org_id: str, status: str = "pending", db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    from app.models.entities import ReviewItem
    q = select(ReviewItem).where(ReviewItem.org_id == org_id)
    if status: q = q.where(ReviewItem.status == status)
    q = q.order_by(ReviewItem.created_at.desc()).limit(50)
    r = await db.execute(q)
    items = r.scalars().all()
    out = []
    for it in items:
        # enrich with title
        title = it.item_id[:8]
        if it.item_type == "decision":
            d = await db.get(Decision, it.item_id)
            if d: title = d.title
        elif it.item_type == "risk":
            from app.models.entities import Risk
            obj = await db.get(Risk, it.item_id)
            if obj: title = obj.title
        elif it.item_type == "question":
            from app.models.entities import Question
            obj = await db.get(Question, it.item_id)
            if obj: title = obj.text[:80]
        out.append({"id": it.id, "meeting_id": it.meeting_id, "item_type": it.item_type, "item_id": it.item_id, "title": title, "status": it.status, "provenance": it.provenance, "created_at": it.created_at})
    return {"count": len(out), "items": out}

@router.post("/review/{item_id}/decision")
async def review_decision(item_id: str, body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.entities import ReviewItem
    it = await db.get(ReviewItem, item_id)
    if not it: raise HTTPException(status_code=404, detail="Review item not found")
    await require_org_member(it.org_id, user, db)
    await require_role(it.org_id, user, db, "ANALYST")
    action = body.get("action")  # accept/edit/reject
    if action not in ("accept","edit","reject"):
        raise HTTPException(status_code=400, detail="action must be accept/edit/reject")
    if action == "accept":
        it.status = "accepted"
        # also confirm decision if it's a decision — through the state machine,
        # never a direct write (a REJECTED decision cannot be silently revived)
        if it.item_type == "decision":
            d = await db.get(Decision, it.item_id)
            log.info(f"Review accept for decision {it.item_id} found {d is not None} status {d.status if d else 'none'}")
            if d:
                validate_decision_transition(d.status, "CONFIRMED")
                if d.status != "CONFIRMED":
                    d.status = "CONFIRMED"
                    from datetime import datetime, timezone
                    d.confirmed_at = datetime.now(timezone.utc)
                    # update DNA provenance
                    r = await db.execute(select(DecisionDNA).where(DecisionDNA.decision_id == d.id))
                    dna = r.scalar_one_or_none()
                    log.info(f"DNA found {dna is not None} provenance {dna.provenance if dna else 'none'}")
                    if dna: dna.provenance = "HUMAN_APPROVED"
    elif action == "reject":
        it.status = "rejected"
        if it.item_type == "decision":
            d = await db.get(Decision, it.item_id)
            if d:
                validate_decision_transition(d.status, "REJECTED")
                d.status = "REJECTED"
    elif action == "edit":
        it.status = "edited"
        new_title = body.get("title")
        if it.item_type == "decision" and new_title:
            title = str(new_title).strip()
            if not title:
                raise HTTPException(status_code=400, detail="Revised title cannot be empty")
            d = await db.get(Decision, it.item_id)
            if d:
                validate_decision_transition(d.status, "REVISED")
                d.title = title[:500]
                if d.status != "REVISED":
                    d.status = "REVISED"
                    from datetime import datetime, timezone
                    d.confirmed_at = datetime.now(timezone.utc)
    from datetime import datetime, timezone
    it.reviewed_at = datetime.now(timezone.utc)
    it.reviewer_id = user.id
    try:
        db.add(AuditLog(org_id=it.org_id, actor_user_id=user.id, action=f"review.{action}", resource_type=it.item_type, resource_id=it.item_id, meta={"review_id": it.id}))
    except Exception as e:
        log.warning(f"audit write failed (review.{action} {it.item_id}): {e}")
    await db.commit()
    return {"id": it.id, "status": it.status}

@router.get("/meetings/{meeting_id}/report")
async def get_report(meeting_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(Meeting, meeting_id)
    if not m: raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    # gather all
    r = await db.execute(select(MeetingUnderstanding).where(MeetingUnderstanding.meeting_id == meeting_id))
    mu = r.scalar_one_or_none()
    r2 = await db.execute(select(ParticipantAnalysis).where(ParticipantAnalysis.meeting_id == meeting_id))
    pas = r2.scalars().all()
    decs = (await db.execute(select(Decision).where(Decision.meeting_id == meeting_id))).scalars().all()
    # build report JSON (PDF-ready structure)
    # fetch DNA for each decision
    dna_map = {}
    for d in decs:
        r3 = await db.execute(select(DecisionDNA).where(DecisionDNA.decision_id == d.id))
        dna = r3.scalar_one_or_none()
        if dna:
            dna_map[d.id] = dna
    acts = (await db.execute(select(ActionItem).where(ActionItem.meeting_id == meeting_id))).scalars().all()
    qs = (await db.execute(select(Question).where(Question.meeting_id == meeting_id))).scalars().all()
    risks = (await db.execute(select(Risk).where(Risk.meeting_id == meeting_id))).scalars().all()
    # fetch branches/research/challenge/recommendation for report
    from app.models.entities import DecisionBranch, ExternalResearch, Challenge, DecisionRecommendation
    branch_map = {}
    research_map = {}
    challenge_map = {}
    reco_map = {}
    for d in decs:
        r = await db.execute(select(DecisionBranch).where(DecisionBranch.decision_id == d.id))
        branch_map[d.id] = r.scalars().all()
        r = await db.execute(select(ExternalResearch).where(ExternalResearch.decision_id == d.id).order_by(ExternalResearch.created_at.desc()).limit(1))
        research_map[d.id] = r.scalars().first()
        r = await db.execute(select(Challenge).where(Challenge.decision_id == d.id).order_by(Challenge.created_at.desc()).limit(1))
        challenge_map[d.id] = r.scalars().first()
        r = await db.execute(select(DecisionRecommendation).where(DecisionRecommendation.decision_id == d.id).order_by(DecisionRecommendation.created_at.desc()).limit(1))
        reco_map[d.id] = r.scalars().first()
    # at-a-glance
    glance = []
    for d in decs:
        dna = dna_map.get(d.id)
        rec = reco_map.get(d.id)
        glance.append({"decision": d.title, "status": d.status, "decision_class": dna.decision_class if dna else "PROPOSED_DECISION", "why": dna.requirements[0] if dna and dna.requirements else d.description, "owner": None, "deadline": None, "risks": dna.risks if dna else [], "recommendation": rec.what if rec else None, "approval": d.status, "evidence_segment_ids": d.transcript_segment_ids})
    return {
        "meeting": {"id": m.id, "title": m.title, "date": m.date, "status": m.status},
        "understanding": {"objective": mu.objective if mu else None, "primary_theme": mu.primary_theme if mu else None, "secondary_themes": mu.secondary_themes if mu else [], "topics": mu.topics if mu else [], "key_discussion_points": mu.key_discussion_points if mu else []} if mu else None,
        "participants": [{"speaker": p.speaker_label, "level": p.participation_level, "topics": p.topics_discussed, "proposals": p.proposals_made, "stance": p.stance, "role": p.role} for p in pas],
        "decisions": [{"id": d.id, "title": d.title, "status": d.status, "confidence": d.confidence, "strength": None, "dna": {"decision_class": dna_map[d.id].decision_class, "provenance": dna_map[d.id].provenance, "requirements": dna_map[d.id].requirements, "constraints": dna_map[d.id].constraints, "expected_outcome": dna_map[d.id].expected_outcome, "risks": dna_map[d.id].risks, "alternatives": dna_map[d.id].alternatives} if d.id in dna_map else None, "branches": [{"branch_type": b.branch_type, "title": b.title, "description": b.description, "provenance": b.provenance} for b in branch_map.get(d.id,[])], "research": {"query": research_map[d.id].query, "sources": research_map[d.id].sources, "status": research_map[d.id].status} if d.id in research_map and research_map[d.id] else None, "challenge": {"health": challenge_map[d.id].health, "concerns": challenge_map[d.id].concerns, "questions": challenge_map[d.id].questions} if d.id in challenge_map and challenge_map[d.id] else None, "recommendation": {"what": reco_map[d.id].what, "why": reco_map[d.id].why, "based_on": reco_map[d.id].based_on, "risks": reco_map[d.id].risks, "next_step": reco_map[d.id].next_step, "confidence": reco_map[d.id].confidence, "status": reco_map[d.id].status} if d.id in reco_map and reco_map[d.id] else None, "evidence_segment_ids": d.transcript_segment_ids} for d in decs],
        "at_a_glance": glance,
        "actions": [{"task": a.task, "owner": a.owner_name, "deadline": a.deadline_raw, "status": a.status, "overdue": _is_overdue(a)} for a in acts],
        "risks": [{"title": r.title, "severity": r.severity, "description": r.description} for r in risks],
        "questions": [{"text": q.text, "status": q.status} for q in qs],
        "generated_at": m.created_at,
    }

@router.get("/search")
async def search(org_id: str, q: str, limit: int = 12, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    if not q or not q.strip():
        return {"query": q, "meetings": [], "decisions": [], "actions": [], "segments": [], "questions": []}
    q = q.strip()[:200]
    # meetings
    r = await db.execute(select(Meeting).where(Meeting.org_id == org_id))
    meetings = r.scalars().all()
    m_docs = [{"id": m.id, "text": f"{m.title}", "meeting": m} for m in meetings]
    m_hits = search_candidates(q, m_docs, text_key="text", limit=limit)

    # decisions
    r = await db.execute(select(Decision).join(Meeting, Decision.meeting_id == Meeting.id).where(Meeting.org_id == org_id))
    decs = r.scalars().all()
    d_docs = [{"id": d.id, "text": f"{d.title} {d.description or ''}", "obj": d} for d in decs]
    d_hits = search_candidates(q, d_docs, text_key="text", limit=limit)

    # actions
    r = await db.execute(select(ActionItem).join(Meeting, ActionItem.meeting_id == Meeting.id).where(Meeting.org_id == org_id))
    acts = r.scalars().all()
    a_docs = [{"id": a.id, "text": f"{a.task} {a.owner_name or ''}", "obj": a} for a in acts]
    a_hits = search_candidates(q, a_docs, text_key="text", limit=limit)

    # transcript segments
    # need to join via transcript
    from sqlalchemy import join as sql_join
    r = await db.execute(select(TranscriptSegment, Meeting.id).select_from(sql_join(TranscriptSegment, Transcript, TranscriptSegment.transcript_id == Transcript.id).join(Meeting, Transcript.meeting_id == Meeting.id)).where(Meeting.org_id == org_id).limit(500))
    seg_rows = r.all()
    s_docs = []
    for seg, mid in seg_rows:
        s_docs.append({"id": seg.id, "text": seg.text, "obj": seg, "meeting_id": mid, "start_ms": seg.start_ms})
    s_hits = search_candidates(q, s_docs, text_key="text", limit=limit)

    # questions
    r = await db.execute(select(Question).join(Meeting, Question.meeting_id == Meeting.id).where(Meeting.org_id == org_id))
    qs = r.scalars().all()
    q_docs = [{"id": qq.id, "text": qq.text, "obj": qq} for qq in qs]
    q_hits = search_candidates(q, q_docs, text_key="text", limit=limit)

    return {
        "query": q,
        "meetings": [{"id": h["id"], "title": h["meeting"].title, "score": h["_score"]} for h in m_hits],
        "decisions": [{"id": h["id"], "title": h["obj"].title, "status": h["obj"].status, "meeting_id": h["obj"].meeting_id, "score": h["_score"]} for h in d_hits],
        "actions": [{"id": h["id"], "task": h["obj"].task, "owner_name": h["obj"].owner_name, "status": h["obj"].status, "meeting_id": h["obj"].meeting_id, "score": h["_score"]} for h in a_hits],
        "segments": [{"id": h["id"], "text": h["text"][:240], "meeting_id": h["meeting_id"], "start_ms": h["start_ms"], "score": h["_score"]} for h in s_hits],
        "questions": [{"id": h["id"], "text": h["obj"].text[:240], "meeting_id": h["obj"].meeting_id, "score": h["_score"]} for h in q_hits],
    }

@router.get("/memory")
async def memory(org_id: str, q: str = None, limit: int = 20, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    # timeline of decisions across meetings, with strength and meeting date, optionally filtered by q
    r = await db.execute(select(Decision).join(Meeting, Decision.meeting_id == Meeting.id).where(Meeting.org_id == org_id).order_by(Meeting.date.desc(), Decision.created_at.desc()).limit(100))
    decs = r.scalars().all()
    # optionally filter by q via BM25 if provided
    if q and q.strip():
        d_docs = [{"id": d.id, "text": f"{d.title} {d.description or ''}", "obj": d} for d in decs]
        hits = search_candidates(q, d_docs, text_key="text", limit=limit)
        decs = [h["obj"] for h in hits]
    else:
        decs = decs[:limit]
    out = []
    for d in decs:
        m = await db.get(Meeting, d.meeting_id)
        # fetch segments for strength
        segs = []
        if d.transcript_segment_ids:
            r2 = await db.execute(select(TranscriptSegment).where(TranscriptSegment.id.in_(d.transcript_segment_ids)))
            segs = list(r2.scalars().all())
        strength = compute_strength(d, segs) if segs else {"score": 50, "level": "medium"}
        out.append({"id": d.id, "title": d.title, "status": d.status, "confidence": d.confidence, "strength": strength, "meeting_id": d.meeting_id, "meeting_title": m.title if m else "", "meeting_date": m.date if m else None, "evidence_segment_ids": d.transcript_segment_ids})
    return {"query": q, "timeline": out}

@router.get("/ledger")
async def ledger(org_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    # only CONFIRMED/REVISED — immutable obligations
    r = await db.execute(select(Decision).join(Meeting, Decision.meeting_id == Meeting.id).where(Meeting.org_id == org_id, Decision.status.in_(["CONFIRMED","REVISED"])).order_by(Decision.confirmed_at.desc().nullslast(), Decision.created_at.desc()).limit(50))
    decs = r.scalars().all()
    out = []
    for d in decs:
        m = await db.get(Meeting, d.meeting_id)
        # audit who confirmed
        r2 = await db.execute(select(AuditLog).where(AuditLog.resource_id == d.id, AuditLog.action.in_(["decision.confirmed","decision.revised"])).order_by(AuditLog.created_at.desc()).limit(1))
        log = r2.scalars().first()
        actor = await db.get(User, log.actor_user_id) if log and log.actor_user_id else None
        out.append({"id": d.id, "title": d.title, "status": d.status, "meeting_title": m.title if m else "", "meeting_id": d.meeting_id, "confirmed_at": d.confirmed_at or d.created_at, "confirmed_by": actor.email if actor else None, "evidence_segment_ids": d.transcript_segment_ids})
    return {"count": len(out), "ledger": out}

@router.get("/health/score")
async def health_score(org_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    r = await db.execute(select(Meeting).where(Meeting.org_id == org_id).order_by(Meeting.date.desc()).limit(20))
    meetings = r.scalars().all()
    total_decisions = 0
    confirmed = 0
    total_actions = 0
    completed = 0
    overdue = 0
    unassigned = 0
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    for m in meetings:
        r1 = await db.execute(select(Decision).where(Decision.meeting_id == m.id))
        decs = r1.scalars().all()
        total_decisions += len(decs)
        confirmed += sum(1 for d in decs if d.status in ("CONFIRMED","REVISED"))
        r2 = await db.execute(select(ActionItem).where(ActionItem.meeting_id == m.id))
        acts = r2.scalars().all()
        total_actions += len(acts)
        completed += sum(1 for a in acts if a.status == "COMPLETED")
        for a in acts:
            if a.status in ("COMPLETED","CANCELLED"): continue
            if not a.owner_name: unassigned += 1
            if a.deadline:
                dl = a.deadline
                if dl.tzinfo is None: dl = dl.replace(tzinfo=timezone.utc)
                if dl < now: overdue += 1
    # health 0-100
    decision_rate = (confirmed / total_decisions * 100) if total_decisions else 100
    completion_rate = (completed / total_actions * 100) if total_actions else 100
    overdue_penalty = min(30, overdue * 6)
    unassigned_penalty = min(20, unassigned * 5)
    health = max(0, int((decision_rate * 0.4 + completion_rate * 0.6) - overdue_penalty - unassigned_penalty))
    level = "high" if health >= 80 else "medium" if health >= 50 else "low"
    return {"health": health, "level": level, "metrics": {"total_decisions": total_decisions, "confirmed_rate": round(decision_rate,1), "total_actions": total_actions, "completed_rate": round(completion_rate,1), "overdue": overdue, "unassigned": unassigned}, "meetings": len(meetings)}

async def _gather_meeting_evidence(db: AsyncSession, org_id: str, question: str):
    """Shared retrieval for the meetings assistant (JSON + SSE endpoints).

    Returns (evidence_items, d_hits, a_hits, s_hits, q_hits). Pure retrieval —
    no LLM, no writes — so both endpoints share identical grounding.
    """
    # retrieval across all types
    # fetch all for scoring (limit to avoid huge)
    decs = (await db.execute(select(Decision).join(Meeting, Decision.meeting_id == Meeting.id).where(Meeting.org_id == org_id).limit(100))).scalars().all()
    acts = (await db.execute(select(ActionItem).join(Meeting, ActionItem.meeting_id == Meeting.id).where(Meeting.org_id == org_id).limit(100))).scalars().all()
    # segments
    from sqlalchemy import join as sql_join
    seg_rows = (await db.execute(select(TranscriptSegment, Meeting).select_from(sql_join(TranscriptSegment, Transcript, TranscriptSegment.transcript_id == Transcript.id).join(Meeting, Transcript.meeting_id == Meeting.id)).where(Meeting.org_id == org_id).order_by(TranscriptSegment.position).limit(400))).all()
    # questions/risks for context
    qs = (await db.execute(select(Question).join(Meeting, Question.meeting_id == Meeting.id).where(Meeting.org_id == org_id).limit(50))).scalars().all()

    # score
    d_docs = [{"id": d.id, "text": f"{d.title} {d.description or ''}", "obj": d} for d in decs]
    a_docs = [{"id": a.id, "text": f"{a.task} {a.owner_name or ''}", "obj": a} for a in acts]
    s_docs = [{"id": seg.id, "text": seg.text, "obj": seg, "meeting": m, "meeting_id": m.id} for seg, m in seg_rows]
    q_docs = [{"id": qq.id, "text": qq.text, "obj": qq} for qq in qs]

    # dedupe helpers
    def dedupe_hits(hits, key_fn):
        seen = set()
        out = []
        for h in hits:
            k = key_fn(h).lower()[:48]
            if k in seen: continue
            seen.add(k)
            out.append(h)
        return out
    d_hits = dedupe_hits(search_candidates(question, d_docs, text_key="text", limit=8), lambda h: h["obj"].title)
    d_hits = d_hits[:3]
    a_hits = dedupe_hits(search_candidates(question, a_docs, text_key="text", limit=8), lambda h: h["obj"].task)
    a_hits = a_hits[:3]
    s_hits = search_candidates(question, s_docs, text_key="text", limit=6)
    q_hits = search_candidates(question, q_docs, text_key="text", limit=2)

    # build evidence payload for LLM or template
    evidence_items = []
    for h in s_hits:
        seg = h["obj"]; m = h["meeting"]
        evidence_items.append(f"[{m.title} {seg.start_ms//1000}s] {seg.speaker_label}: \"{seg.text}\" (segment {seg.id})")
    for h in d_hits:
        d = h["obj"]
        evidence_items.append(f"Decision: \"{d.title}\" [{d.status}] confidence {d.confidence} (id {d.id}, meeting {d.meeting_id})")
    for h in a_hits:
        a = h["obj"]
        evidence_items.append(f"Action: \"{a.task}\" owner {a.owner_name or 'unassigned'} status {a.status} deadline {a.deadline_raw or 'none'} (id {a.id})")
    return evidence_items, d_hits, a_hits, s_hits, q_hits


def _template_meeting_answer(evidence_items, d_hits, a_hits, s_hits, q_hits):
    """Safe template fallback — no hallucination. Shared by JSON + SSE paths."""
    if not evidence_items:
        return "I couldn't find evidence for that in your meetings. Try rephrasing or ask about a specific decision, person, or topic."
    parts = []
    if d_hits:
        parts.append(f"Found {len(d_hits)} relevant decision(s): " + "; ".join([f"\"{h['obj'].title}\" [{h['obj'].status}]" for h in d_hits]))
    if a_hits:
        parts.append(f"Found {len(a_hits)} relevant action(s): " + "; ".join([f"\"{h['obj'].task}\" ({h['obj'].owner_name or 'unassigned'})" for h in a_hits]))
    if s_hits:
        parts.append("Evidence transcript moments:\n" + "\n".join([f"- {h['obj'].text[:120]} ({h['meeting'].title} {h['obj'].start_ms//1000}s)" for h in s_hits[:3]]))
    if q_hits:
        parts.append(f"Open question: \"{q_hits[0]['obj'].text}\"")
    return "\n\n".join(parts) + "\n\n_Answer grounded in evidence above — click evidence to jump to transcript._"


def _assemble_meeting_response(answer, d_hits, a_hits, s_hits, q_hits):
    """Shared final shape (JSON + SSE done event)."""
    evidence = []
    by_meeting = {}
    for h in s_hits:
        by_meeting.setdefault(h["meeting_id"], []).append(h["id"])
    for mid, sids in by_meeting.items():
        evidence.append({"meeting_id": mid, "segment_ids": sids})
    for h in d_hits:
        evidence.append({"meeting_id": h["obj"].meeting_id, "segment_ids": h["obj"].transcript_segment_ids or []})
    for h in a_hits:
        evidence.append({"meeting_id": h["obj"].meeting_id, "segment_ids": h["obj"].transcript_segment_ids or []})
    return {
        "answer": answer,
        "evidence": evidence,
        "decisions": [h["obj"].title for h in d_hits],
        "actions": [h["obj"].task for h in a_hits],
        "segments": [{"id": h["id"], "text": h["obj"].text[:240], "meeting_id": h["meeting_id"], "start_ms": h["obj"].start_ms} for h in s_hits],
        "questions": [h["obj"].text for h in q_hits],
    }


@router.post("/assistant/query")
@limiter.limit("30/minute")
async def assistant_query(body: dict, org_id: str, request: Request, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    question = (body.get("question") or body.get("query") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")
    if len(question) > 800:
        raise HTTPException(status_code=400, detail="question too long (max 800)")
    from app.config.settings import get_settings
    from app.services.answer_cache import lookup as cache_lookup, org_fingerprint, store as cache_store
    settings = get_settings()
    provider_name = (settings.ai_provider or "local").lower()
    model_name = settings.groq_model if provider_name == "groq" else settings.openai_model
    fp = await org_fingerprint(db, org_id)
    hit = await cache_lookup(db, scope="meetings", subject_id=org_id, question=question,
                             provider=provider_name, model=model_name, fingerprint=fp,
                             ttl_seconds=settings.meetings_cache_ttl_seconds)
    if hit is not None:
        return {**hit, "cached": True}

    evidence_items, d_hits, a_hits, s_hits, q_hits = await _gather_meeting_evidence(db, org_id, question)

    # try LLM grounded generation (OpenAI or Groq via shared builder)
    from app.config.settings import get_settings
    from app.ai.provider import build_chat_client, chat_completion
    settings = get_settings()
    answer = None
    client_model = build_chat_client(settings)
    if client_model[0] is not None:
        try:
            import json as js
            client, model = client_model
            evidence_str = "\n".join(evidence_items[:14])[:8000]
            system = (
                "You are Decentra evidence-grounded assistant. ONLY use provided evidence. "
                "Never invent meetings, people, or numbers. If evidence insufficient, say so. "
                "Cite evidence inline like [Meeting Title 42s] or [Decision id]. "
                "Respond JSON: {answer: string (markdown), confidence: 0-1}."
            )
            user_msg = f"Question: {question}\n\nEvidence:\n{evidence_str}\n\nAnswer concisely, cite evidence."
            resp = await chat_completion(
                client, max_retries=settings.llm_max_retries,
                base_seconds=settings.llm_retry_base_seconds,
                model=model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user_msg}],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            parsed = js.loads(resp.choices[0].message.content)
            answer = parsed.get("answer")
        except Exception as e:
            log.warning(f"assistant LLM failed: {e}")

    if not answer:
        answer = _template_meeting_answer(evidence_items, d_hits, a_hits, s_hits, q_hits)

    full = _assemble_meeting_response(answer, d_hits, a_hits, s_hits, q_hits)
    await cache_store(db, scope="meetings", subject_id=org_id, question=question,
                      provider=provider_name, model=model_name, fingerprint=fp,
                      response=full, ttl_seconds=settings.meetings_cache_ttl_seconds)
    return full


@router.post("/assistant/query/stream")
@limiter.limit("30/minute")
async def assistant_query_stream(body: dict, org_id: str, request: Request, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """SSE twin of /assistant/query. Events: evidence → token* → done | error.

    Evidence streams first so the UI renders citations while tokens arrive.
    Cache hits emit the same shape instantly (one token + done, no LLM).
    """
    from fastapi.responses import StreamingResponse
    from app.utils.sse import SSE_HEADERS, frame
    await require_org_member(org_id, user, db)
    question = (body.get("question") or body.get("query") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")
    if len(question) > 800:
        raise HTTPException(status_code=400, detail="question too long (max 800)")
    from app.config.settings import get_settings
    from app.ai.provider import build_chat_client, stream_chat
    from app.services.answer_cache import lookup as _lookup, org_fingerprint as _fp, store as _store
    settings = get_settings()
    provider_name = (settings.ai_provider or "local").lower()
    model_name = settings.groq_model if provider_name == "groq" else settings.openai_model
    fp = await _fp(db, org_id)
    hit = await _lookup(db, scope="meetings", subject_id=org_id, question=question,
                        provider=provider_name, model=model_name, fingerprint=fp,
                        ttl_seconds=settings.meetings_cache_ttl_seconds)

    async def gen():
        if hit is not None:
            yield frame("evidence", {"evidence": hit.get("evidence", []),
                                     "decisions": hit.get("decisions", []),
                                     "actions": hit.get("actions", []),
                                     "segments": hit.get("segments", []),
                                     "cached": True})
            yield frame("token", {"delta": hit.get("answer", "")})
            yield frame("done", {**hit, "cached": True})
            return
        evidence_items, d_hits, a_hits, s_hits, q_hits = await _gather_meeting_evidence(db, org_id, question)
        preview = _assemble_meeting_response("", d_hits, a_hits, s_hits, q_hits)
        yield frame("evidence", preview)
        client_model = build_chat_client(settings)
        buf: list[str] = []
        answer = None
        try:
            if client_model[0] is not None:
                client, model = client_model
                evidence_str = "\n".join(evidence_items[:14])[:8000]
                system = (
                    "You are Decentra evidence-grounded assistant. ONLY use provided evidence. "
                    "Never invent meetings, people, or numbers. If evidence insufficient, say so. "
                    "Cite evidence inline like [Meeting Title 42s] or [Decision id]. "
                    "Respond JSON: {answer: string (markdown), confidence: 0-1}."
                )
                user_msg = f"Question: {question}\n\nEvidence:\n{evidence_str}\n\nAnswer concisely, cite evidence."
                async for delta in stream_chat(client, model, system, user_msg):
                    buf.append(delta)
                    yield frame("token", {"delta": delta})
                import json as js
                try:
                    answer = js.loads("".join(buf)).get("answer", "".join(buf))
                except Exception:
                    answer = "".join(buf) or None
            if not answer:
                template = _template_meeting_answer(evidence_items, d_hits, a_hits, s_hits, q_hits)
                for piece in template.split(" "):
                    yield frame("token", {"delta": piece + " "})
                answer = template
        except Exception as e:
            log.warning("assistant stream failed: %s", type(e).__name__)
            partial = "".join(buf)
            yield frame("error", {"message": "Generation interrupted — showing partial answer.",
                                  "partial": partial})
            answer = partial or _template_meeting_answer(evidence_items, d_hits, a_hits, s_hits, q_hits)
        full = _assemble_meeting_response(answer, d_hits, a_hits, s_hits, q_hits)
        await _store(db, scope="meetings", subject_id=org_id, question=question,
                     provider=provider_name, model=model_name, fingerprint=fp,
                     response=full, ttl_seconds=settings.meetings_cache_ttl_seconds)
        yield frame("done", full)

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)
