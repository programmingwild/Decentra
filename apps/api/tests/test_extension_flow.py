"""Extension contract test: the exact payload apps/extension/background.js
sends must flow through the real pipeline (recording -> transcript ->
intelligence) with zero mocks.
"""
import json

import pytest


@pytest.mark.asyncio
async def test_extension_transcript_flow(client):
    # register + org (mirrors popup login + org pick)
    r = await client.post("/api/v1/auth/register",
                          json={"email": "ext@decentra.ai", "password": "strongpass1"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    H = {"Authorization": f"Bearer {token}"}

    r = await client.post("/api/v1/organizations", json={"name": "Ext Org"}, headers=H)
    assert r.status_code == 200, r.text
    org_id = r.json()["id"]

    # POP_START: create meeting
    r = await client.post(f"/api/v1/meetings?org_id={org_id}",
                          json={"title": "Captured meeting"}, headers=H)
    assert r.status_code == 200, r.text
    mid = r.json()["id"]

    # POP_STOP: transcript.json shaped EXACTLY like the extension sends it
    payload = {
        "source": "decentra-extension",
        "segments": [
            {"speaker": "Priya", "start": 0, "end": 6,
             "text": "Let's go with PostgreSQL for version one, the team knows it well."},
            {"speaker": "Arun", "start": 7, "end": 13,
             "text": "I'll prepare the database schema before Friday."},
            {"speaker": "Priya", "start": 14, "end": 20,
             "text": "Which authentication provider should we use?"},
        ],
    }
    files = {"file": ("transcript.json", json.dumps(payload), "application/json")}
    r = await client.post(f"/api/v1/meetings/{mid}/recording", files=files, headers=H)
    assert r.status_code == 200, r.text

    r = await client.post(f"/api/v1/meetings/{mid}/process", headers=H)
    assert r.status_code == 200, r.text

    # The endpoint queues a background task (runs on a real server). Here we
    # drive the exact same pipeline functions directly and deterministically.
    from app.services.intelligence import extract_intelligence
    from app.services.transcription import create_transcript
    from tests.conftest import TestSession
    async with TestSession() as db:
        await create_transcript(mid, db, force=True)
        await extract_intelligence(mid, db)

    # transcript persisted with speakers + timings
    r = await client.get(f"/api/v1/meetings/{mid}/transcript", headers=H)
    assert r.status_code == 200, r.text
    segs = r.json()["segments"]
    assert len(segs) == 3
    assert segs[0]["speaker_label"] == "Priya"
    assert segs[0]["start_ms"] == 0 and segs[1]["start_ms"] == 7000

    # generic heuristic (no mocks) extracted evidence-grounded intelligence
    r = await client.get(f"/api/v1/meetings/{mid}/intelligence", headers=H)
    assert r.status_code == 200, r.text
    intel = r.json()
    assert intel["decisions"], "heuristic must detect the 'let's go with' decision"
    d = intel["decisions"][0]
    assert d["evidence_segment_ids"], "decision must carry evidence"
    assert any("schema" in (a["task"] or "").lower() for a in intel["actions"]), \
        "heuristic must extract the schema action"
