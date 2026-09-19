"""Meeting Intelligence & Auto-Elimination Engine (prevention layer).

Purely additive: stateless, deterministic analysis over existing meeting
data. No new tables, no changes to existing flows. Every verdict is
explainable — each reason carries its score impact.

Endpoints:
  GET /api/v1/meetings/{id}/elimination  — should-this-meeting-exist verdict
  GET /api/v1/roi/meetings?org_id=...    — calendar ROI dashboard data
  GET /api/v1/meetings/{id}/brief        — personalized 3-bullet digest
"""
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import get_current_user
from app.database.session import get_db
from app.models.entities import (
    ActionItem,
    Decision,
    Meeting,
    OrganizationMember,
    Participant,
    Question,
    User,
)
from app.api.routes.meetings import require_org_member

elimination_router = APIRouter(prefix="/api/v1", tags=["elimination"])

# Title signals — deterministic, explainable, no LLM required.
GENERIC_TITLES = ("sync", "standup", "stand-up", "catch up", "catch-up", "check-in", "check in", "touch base", "weekly", "daily", "huddle", "chat")
STATUS_WORDS = ("status", "update", "report", "roundup", "round-up", "recap")
DECISION_WORDS = ("decid", "approv", "kickoff", "kick-off", "planning", "negotiat", "hire", "hiring", "offer", "contract", "incident", "postmortem", "post-mortem", "retro", "launch", "budget", "priorit")


def _score_meeting(title: str, attendees: int, duration_min: float, zero_rate: float, past_outcomes: int | None):
    """Returns (need_score, reasons). Reasons carry signed impacts for the UI."""
    score = 55
    reasons: list[dict] = []
    t = (title or "").lower().strip()

    if not t:
        score -= 10
        reasons.append({"signal": "no-title", "impact": -10, "detail": "Untitled invites never carry a decision — name the outcome, not the ritual."})
    elif any(g in t for g in GENERIC_TITLES):
        score -= 18
        reasons.append({"signal": "generic-title", "impact": -18, "detail": f"“{title}” frames a ritual, not a decision. Status rounds dissolve into threads."})
    if any(w in t for w in STATUS_WORDS):
        score -= 12
        reasons.append({"signal": "status-broadcast", "impact": -12, "detail": "Reads as a status broadcast — one written thread replaces the whole call."})
    if any(w in t for w in DECISION_WORDS):
        score += 15
        reasons.append({"signal": "decision-framed", "impact": 15, "detail": "Title frames a real decision. Decisions deserve a room — and a lock afterwards."})

    if attendees <= 0:
        score -= 5
        reasons.append({"signal": "no-attendees", "impact": -5, "detail": "Nobody is strictly required. If nobody must be there, nothing must happen."})
    elif attendees <= 3:
        score += 5
        reasons.append({"signal": "tight-room", "impact": 5, "detail": f"{attendees} people can actually decide something together."})
    elif attendees <= 6:
        reasons.append({"signal": "normal-room", "impact": 0, "detail": f"{attendees} attendees — workable if an agenda names the decision."})
    elif attendees <= 10:
        score -= 10
        reasons.append({"signal": "crowded-room", "impact": -10, "detail": f"{attendees} people rarely decide together — 8/10 of them are optional."})
    else:
        score -= 18
        reasons.append({"signal": "broadcast-room", "impact": -18, "detail": f"{attendees} attendees is a broadcast, not a meeting. Record a 2-minute digest instead."})

    if duration_min <= 15:
        score += 5
        reasons.append({"signal": "short-box", "impact": 5, "detail": "15 minutes respects everyone — cheap enough to keep."})
    elif duration_min > 60:
        score -= 8
        reasons.append({"signal": "long-box", "impact": -8, "detail": f"{duration_min:.0f} minutes with no locked decision is where calendars go to die."})

    if zero_rate > 0.5:
        score -= 8
        reasons.append({"signal": "cold-streak", "impact": -8, "detail": f"This org converts only {round((1 - zero_rate) * 100)}% of meetings into outcomes. Default to async until the streak breaks."})

    if past_outcomes is not None:
        if past_outcomes == 0:
            score -= 10
            reasons.append({"signal": "zero-outcome-history", "impact": -10, "detail": "This meeting previously recorded zero decisions and zero actions. History votes async."})
        elif past_outcomes >= 3:
            score += 8
            reasons.append({"signal": "proven-producer", "impact": 8, "detail": f"Previously produced {past_outcomes} outcomes. Proven rooms earn their slot."})

    return max(0, min(100, score)), reasons


def _verdict(score: int) -> tuple[str, str]:
    if score >= 60:
        return "MEET", "Hold it — but lock every decision before anyone leaves."
    if score >= 40:
        return "ASYNC", "Don't meet. Run the async thread below instead."
    return "SKIP", "Cancel it. Nothing here needs synchronized schedules."


def _async_draft(title: str, attendees: int, duration_min: float) -> str:
    people = f"{attendees} people" if attendees else "the team"
    return (
        f"Async replacement for “{title or 'this meeting'}” ({people} × {duration_min:.0f} min reclaimed):\n"
        f"1. Each owner posts a 3-line status in-thread by EOD — done / next / blocked.\n"
        f"2. Anything needing a call gets proposed as a decision with options, not a meeting invite.\n"
        f"3. The group votes async within 24h. Only unresolved items earn a 15-minute huddle.\n"
        f"4. Locked decisions go straight to the Decision Log with evidence links."
    )


async def _counts(db: AsyncSession, meeting_id: str) -> tuple[int, int, int]:
    pc = await db.execute(select(func.count()).select_from(Participant).where(Participant.meeting_id == meeting_id))
    dc = await db.execute(select(func.count()).select_from(Decision).where(Decision.meeting_id == meeting_id))
    ac = await db.execute(select(func.count()).select_from(ActionItem).where(ActionItem.meeting_id == meeting_id))
    return (pc.scalar() or 0, dc.scalar() or 0, ac.scalar() or 0)


async def _zero_rate(db: AsyncSession, org_id: str) -> float:
    ms = await db.execute(select(Meeting.id).where(Meeting.org_id == org_id, Meeting.status == "ready"))
    ids = [r for (r,) in ms.all()]
    if not ids:
        return 0.0
    zeros = 0
    for mid in ids:
        _, d, a = await _counts(db, mid)
        if d == 0 and a == 0:
            zeros += 1
    return zeros / len(ids)


@elimination_router.get("/meetings/{meeting_id}/elimination")
async def elimination_verdict(meeting_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)
    attendees, dcnt, acnt = await _counts(db, meeting_id)
    duration_min = (m.duration_ms or 0) / 60000
    zero_rate = await _zero_rate(db, m.org_id)
    past = (dcnt + acnt) if m.status == "ready" else None
    score, reasons = _score_meeting(m.title, attendees, duration_min, zero_rate, past)
    verdict, guidance = _verdict(score)
    hours = round(duration_min / 60 * max(attendees, 1), 1)
    return {
        "meeting_id": m.id,
        "title": m.title,
        "status": m.status,
        "need_score": score,
        "verdict": verdict,
        "guidance": guidance,
        "reasons": reasons,
        "attendee_count": attendees,
        "duration_min": round(duration_min, 1),
        "async_draft": _async_draft(m.title, attendees, duration_min),
        "hours_saved": hours if verdict != "MEET" else 0.0,
        "org_zero_outcome_rate": round(zero_rate, 2),
    }


@elimination_router.get("/roi/meetings")
async def meeting_roi(org_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await require_org_member(org_id, user, db)
    r = await db.execute(select(Meeting).where(Meeting.org_id == org_id).order_by(Meeting.date.desc()))
    meetings = r.scalars().all()
    zero_rate = await _zero_rate(db, org_id)

    total_hours = 0.0
    waste_hours = 0.0
    rows = []
    for m in meetings:
        attendees, dcnt, acnt = await _counts(db, m.id)
        duration_min = (m.duration_ms or 0) / 60000
        hours = duration_min / 60 * max(attendees, 1)
        total_hours += hours
        barren = (dcnt + acnt) == 0
        if barren and m.status == "ready":
            waste_hours += hours
        score, _ = _score_meeting(m.title, attendees, duration_min, zero_rate, (dcnt + acnt) if m.status == "ready" else None)
        verdict, _ = _verdict(score)
        rows.append({
            "id": m.id,
            "title": m.title,
            "date": m.date.isoformat() if m.date else None,
            "status": m.status,
            "attendees": attendees,
            "duration_min": round(duration_min, 1),
            "decisions": dcnt,
            "actions": acnt,
            "barren": barren and m.status == "ready",
            "need_score": score,
            "verdict": verdict,
            "hours": round(hours, 1),
        })
    rows.sort(key=lambda x: (not x["barren"], -x["hours"]))
    return {
        "org_id": org_id,
        "meeting_count": len(meetings),
        "total_hours": round(total_hours, 1),
        "waste_hours": round(waste_hours, 1),
        "waste_pct": round((waste_hours / total_hours * 100) if total_hours else 0, 1),
        "org_zero_outcome_rate": round(zero_rate, 2),
        "rows": rows,
    }


@elimination_router.get("/meetings/{meeting_id}/brief")
async def meeting_brief(
    meeting_id: str,
    role: str = "default",
    owner_name: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Personalized 3-bullet digest — the distribution layer. Deterministic
    extraction over existing intelligence tables; no new data required."""
    m = await db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await require_org_member(m.org_id, user, db)

    ds = await db.execute(select(Decision).where(Decision.meeting_id == meeting_id).order_by(Decision.confidence.desc().nullslast()))
    decisions = ds.scalars().all()
    ac = await db.execute(select(ActionItem).where(ActionItem.meeting_id == meeting_id))
    actions = ac.scalars().all()
    qs = await db.execute(select(Question).where(Question.meeting_id == meeting_id, Question.status == "OPEN"))
    questions = qs.scalars().all()

    confirmed = [d for d in decisions if d.status == "CONFIRMED"]
    mine = [a for a in actions if owner_name and a.owner_name and owner_name.lower() in a.owner_name.lower()]
    overdue = [a for a in actions if a.status not in ("COMPLETED", "CANCELLED")]

    role = (role or "default").lower()
    bullets: list[str] = []
    if role == "owner" and (owner_name or mine):
        who = owner_name or "you"
        if mine:
            tasks = "; ".join(f"{a.task} ({a.deadline_raw or 'no date'})" for a in mine[:3])
            bullets.append(f"{who} owe{'' if who == 'you' else 's'}: {tasks}.")
        else:
            bullets.append(f"No actions assigned to {who} — nothing to carry out of this one.")
        bullets.append(
            f"Decided: {confirmed[0].title}." if confirmed else
            (f"Proposed, awaiting review: {decisions[0].title}." if decisions else "No decisions recorded yet.")
        )
        bullets.append(
            f"{len(overdue)} open action{'' if len(overdue) == 1 else 's'} still moving — check yours before Friday."
            if overdue else "Action list is clean — everything completed or cancelled."
        )
    elif role == "lead":
        bullets.append(
            f"Decided ({len(confirmed)} locked): " + ("; ".join(d.title for d in confirmed[:2]) + "." if confirmed else "nothing locked yet — review queue holds the proposals.")
        )
        bullets.append(
            f"In flight: {len(actions)} actions, {len(overdue)} still open."
            if actions else "No actions spawned — a meeting with no follow-through."
        )
        bullets.append(
            f"Unresolved: {questions[0].text}" if questions else "No open questions — the thread is settled."
        )
    else:
        bullets.append(
            f"Headline: {confirmed[0].title}." if confirmed else
            (f"To review: {decisions[0].title}." if decisions else "Nothing decided yet.")
        )
        bullets.append(
            f"Your world: {len(actions)} actions total, {len(overdue)} open."
            if actions else "No action items came out of this meeting."
        )
        bullets.append(
            f"Still open: {questions[0].text}" if questions else "No loose ends — every thread tied off."
        )
    return {"meeting_id": m.id, "title": m.title, "role": role, "bullets": bullets[:3]}
