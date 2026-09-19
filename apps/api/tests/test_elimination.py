"""Unit tests for the auto-elimination engine.

Pure scoring logic only — no database, no network. The verdict must stay
deterministic: same inputs, same score, every time.
"""
from app.api.routes.elimination import _async_draft, _score_meeting, _verdict


def test_generic_standup_gets_killed():
    score, reasons = _score_meeting("Team Standup", 9, 30, 0.6, None)
    assert score < 40
    assert _verdict(score)[0] == "SKIP"
    signals = {r["signal"] for r in reasons}
    assert {"generic-title", "crowded-room", "cold-streak"} <= signals


def test_decision_meeting_survives():
    score, reasons = _score_meeting("Q3 Budget Approval", 3, 30, 0.1, 4)
    assert score >= 60
    assert _verdict(score)[0] == "MEET"
    signals = {r["signal"] for r in reasons}
    assert "decision-framed" in signals
    assert "proven-producer" in signals


def test_status_update_goes_async():
    score, _ = _score_meeting("Project Status Update", 5, 30, 0.2, None)
    verdict, _ = _verdict(score)
    assert verdict == "ASYNC"


def test_weekly_ritual_gets_skipped():
    score, _ = _score_meeting("Weekly Status Update", 6, 60, 0.2, None)
    assert score < 40
    assert _verdict(score)[0] == "SKIP"


def test_score_is_bounded_and_stable():
    for title in ["", "Sync", "Postmortem: outage 9/5", "1:1 with Priya"]:
        s1, _ = _score_meeting(title, 5, 45, 0.3, None)
        s2, _ = _score_meeting(title, 5, 45, 0.3, None)
        assert s1 == s2
        assert 0 <= s1 <= 100


def test_async_draft_names_the_meeting():
    draft = _async_draft("Sprint Planning", 8, 60)
    assert "Sprint Planning" in draft
    assert "8 people" in draft
    assert "Decision Log" in draft
