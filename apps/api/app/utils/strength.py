from app.models.entities import Decision, TranscriptSegment

CERTAINTY_BOOST = {"will": 12, "shall": 12, "agreed": 14, "decided": 14, "selected": 10, "confirmed": 12, "must": 10, "think": -8, "maybe": -12, "perhaps": -12, "could": -6, "might": -8}

def compute_strength(decision: Decision, segments: list[TranscriptSegment]) -> dict:
    """
    Returns {score: 0-100, level: low|medium|high, factors: []}
    Evidence-grounded, deterministic, safe.
    """
    seg_ids = set(decision.transcript_segment_ids or [])
    evid_segs = [s for s in segments if s.id in seg_ids]
    base = 45
    factors = []

    # segments count
    cnt = len(evid_segs)
    if cnt >= 3:
        base += 18; factors.append("3+ evidence moments +18")
    elif cnt == 2:
        base += 10; factors.append("2 moments +10")
    elif cnt == 1:
        base += 4; factors.append("1 moment +4")

    # speaker diversity
    speakers = set(s.speaker_label for s in evid_segs)
    if len(speakers) >= 2:
        base += 12; factors.append(f"{len(speakers)} speakers +12")
    elif len(speakers) == 1 and cnt > 1:
        base += 4

    # verb certainty
    text = " ".join(s.text.lower() for s in evid_segs)
    for verb, delta in CERTAINTY_BOOST.items():
        if verb in text:
            base += delta
            factors.append(f"{verb} {delta:+d}")
            if delta > 10: break  # cap one strong boost

    # confidence from extractor
    if decision.confidence is not None:
        base += int((decision.confidence - 0.7) * 22)  # 0.7->0, 0.92->~5

    # repetition hint: title length (more specific)
    if len(decision.title) > 28:
        base += 4

    score = max(0, min(100, base))
    level = "high" if score >= 75 else "medium" if score >= 50 else "low"
    return {"score": score, "level": level, "factors": factors[:4], "segments": cnt, "speakers": len(speakers)}
