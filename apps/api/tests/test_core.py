"""Grade-assurance suite for the core concept.

Every test below guards an invariant the product promise depends on:
  - detected is not true: status moves only along the lifecycle, on EVERY
    mutation path (PATCH and review accept/reject/edit alike)
  - provenance is complete: each mutation writes an auditable row, including
    automatic side effects (supersede)
  - evidence is real: segment links must exist and belong to the meeting
"""
import pytest
import pytest_asyncio
from sqlalchemy import select

from app.auth.security import create_access_token, hash_password
from app.models.entities import (
    ActionItem,
    AuditLog,
    Decision,
    Meeting,
    Organization,
    OrganizationMember,
    ReviewItem,
    User,
)
from tests.conftest import TestSession


@pytest_asyncio.fixture
async def ctx():
    """One ADMIN user, one org, one meeting. Returns dict of rows + headers."""
    async with TestSession() as db:
        user = User(email="qa@decentra.ai", password_hash=hash_password("secret123"), full_name="QA Engineer")
        db.add(user)
        await db.flush()
        org = Organization(name="QA Org", slug="qa-org", created_by=user.id)
        db.add(org)
        await db.flush()
        db.add(OrganizationMember(org_id=org.id, user_id=user.id, role="ADMIN"))
        meeting = Meeting(org_id=org.id, title="Sprint Planning", status="draft", duration_ms=1_800_000)
        db.add(meeting)
        await db.flush()
        await db.commit()
        headers = {"Authorization": f"Bearer {create_access_token(user.id)}"}
        return {"db": db, "user": user, "org": org, "meeting": meeting, "headers": headers, "mid": meeting.id}


async def _decision(db, meeting_id, title="PostgreSQL for v1", status="DETECTED"):
    d = Decision(meeting_id=meeting_id, title=title, status=status)
    db.add(d)
    await db.flush()
    return d


async def _action(db, meeting_id, task="Prepare schema", status="NOT_STARTED"):
    a = ActionItem(meeting_id=meeting_id, task=task, status=status)
    db.add(a)
    await db.flush()
    return a


async def _audit_rows(db, resource_id):
    r = await db.execute(select(AuditLog).where(AuditLog.resource_id == resource_id).order_by(AuditLog.created_at))
    return r.scalars().all()


# ── decision lifecycle ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_decision_confirm_writes_audit(client, ctx):
    d = await _decision(ctx["db"], ctx["mid"])
    await ctx["db"].commit()
    did = d.id
    r = await client.patch(f"/api/v1/decisions/{did}", json={"status": "CONFIRMED"}, headers=ctx["headers"])
    assert r.status_code == 200, r.text
    rows = await _audit_rows(ctx["db"], did)
    assert any(x.action == "decision.confirmed" for x in rows)
    confirmed = [x for x in rows if x.action == "decision.confirmed"][0]
    assert confirmed.meta["old_status"] == "DETECTED"
    assert confirmed.meta["new_status"] == "CONFIRMED"
    assert confirmed.actor_user_id == ctx["user"].id


@pytest.mark.asyncio
async def test_decision_illegal_jump_rejected(client, ctx):
    d = await _decision(ctx["db"], ctx["mid"], status="REJECTED")
    await ctx["db"].commit()
    did = d.id
    r = await client.patch(f"/api/v1/decisions/{did}", json={"status": "CONFIRMED"}, headers=ctx["headers"])
    assert r.status_code == 400
    assert "Invalid transition REJECTED -> CONFIRMED" in r.text


@pytest.mark.asyncio
async def test_decision_empty_title_rejected(client, ctx):
    d = await _decision(ctx["db"], ctx["mid"])
    await ctx["db"].commit()
    r = await client.patch(f"/api/v1/decisions/{d.id}", json={"title": "   "}, headers=ctx["headers"])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_decision_foreign_evidence_rejected(client, ctx):
    d = await _decision(ctx["db"], ctx["mid"])
    await ctx["db"].commit()
    r = await client.patch(
        f"/api/v1/decisions/{d.id}", json={"transcript_segment_ids": ["does-not-exist"]}, headers=ctx["headers"]
    )
    assert r.status_code == 400
    assert "Invalid segment ids" in r.text


@pytest.mark.asyncio
async def test_confirm_supersedes_and_audits_duplicates(client, ctx):
    a = await _decision(ctx["db"], ctx["mid"], title="PostgreSQL selected for version one")
    b = await _decision(ctx["db"], ctx["mid"], title="PostgreSQL selected for version one!")
    await ctx["db"].commit()
    aid, bid = a.id, b.id
    r = await client.patch(f"/api/v1/decisions/{aid}", json={"status": "CONFIRMED"}, headers=ctx["headers"])
    assert r.status_code == 200
    ctx["db"].expire_all()
    other = await ctx["db"].get(Decision, bid)
    assert other.status == "SUPERSEDED"
    rows = await _audit_rows(ctx["db"], bid)
    assert any(x.action == "decision.superseded" and x.meta.get("superseded_by") == aid for x in rows)


# ── review queue honors the same machine ────────────────────────

async def _review_item(db, org_id, meeting_id, decision):
    it = ReviewItem(org_id=org_id, meeting_id=meeting_id, item_type="decision", item_id=decision.id, status="pending")
    db.add(it)
    await db.flush()
    await db.commit()
    return it


@pytest.mark.asyncio
async def test_review_accept_confirms(client, ctx):
    d = await _decision(ctx["db"], ctx["mid"])
    it = await _review_item(ctx["db"], ctx["org"].id, ctx["mid"], d)
    did, itid = d.id, it.id
    r = await client.post(f"/api/v1/review/{itid}/decision", json={"action": "accept"}, headers=ctx["headers"])
    assert r.status_code == 200, r.text
    ctx["db"].expire_all()
    assert (await ctx["db"].get(Decision, did)).status == "CONFIRMED"
    rows = await _audit_rows(ctx["db"], did)
    assert any(x.action == "review.accept" for x in rows)


@pytest.mark.asyncio
async def test_review_accept_cannot_revive_rejected(client, ctx):
    d = await _decision(ctx["db"], ctx["mid"], status="REJECTED")
    it = await _review_item(ctx["db"], ctx["org"].id, ctx["mid"], d)
    did, itid = d.id, it.id
    r = await client.post(f"/api/v1/review/{itid}/decision", json={"action": "accept"}, headers=ctx["headers"])
    assert r.status_code == 400
    ctx["db"].expire_all()
    assert (await ctx["db"].get(Decision, did)).status == "REJECTED"


@pytest.mark.asyncio
async def test_review_reject_and_edit(client, ctx):
    d = await _decision(ctx["db"], ctx["mid"])
    it = await _review_item(ctx["db"], ctx["org"].id, ctx["mid"], d)
    did, itid = d.id, it.id
    r = await client.post(f"/api/v1/review/{itid}/decision", json={"action": "reject"}, headers=ctx["headers"])
    assert r.status_code == 200
    ctx["db"].expire_all()
    assert (await ctx["db"].get(Decision, did)).status == "REJECTED"

    d2 = await _decision(ctx["db"], ctx["mid"], title="Original wording")
    it2 = await _review_item(ctx["db"], ctx["org"].id, ctx["mid"], d2)
    d2id, it2id = d2.id, it2.id
    r = await client.post(f"/api/v1/review/{it2id}/decision", json={"action": "edit", "title": "Revised wording"}, headers=ctx["headers"])
    assert r.status_code == 200, r.text
    ctx["db"].expire_all()
    got = await ctx["db"].get(Decision, d2id)
    assert got.status == "REVISED" and got.title == "Revised wording"

    d3 = await _decision(ctx["db"], ctx["mid"], title="Keep me")
    it3 = await _review_item(ctx["db"], ctx["org"].id, ctx["mid"], d3)
    it3id = it3.id
    r = await client.post(f"/api/v1/review/{it3id}/decision", json={"action": "edit", "title": "   "}, headers=ctx["headers"])
    assert r.status_code == 400


# ── action lifecycle ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_action_transitions_and_audit(client, ctx):
    a = await _action(ctx["db"], ctx["mid"])
    await ctx["db"].commit()
    aid = a.id
    r = await client.patch(f"/api/v1/actions/{aid}", json={"status": "COMPLETED"}, headers=ctx["headers"])
    assert r.status_code == 200, r.text
    r = await client.patch(f"/api/v1/actions/{aid}", json={"status": "NOT_STARTED"}, headers=ctx["headers"])
    assert r.status_code == 200
    rows = await _audit_rows(ctx["db"], aid)
    assert any(x.action == "action.completed" for x in rows)

    b = await _action(ctx["db"], ctx["mid"], task="Cancelled work", status="CANCELLED")
    await ctx["db"].commit()
    bid = b.id
    r = await client.patch(f"/api/v1/actions/{bid}", json={"status": "COMPLETED"}, headers=ctx["headers"])
    assert r.status_code == 400

