import logging

log = logging.getLogger("decentra.reco")

async def recommend(decision, dna, challenge_result, external_sources) -> dict:
    """
    Returns {what, why, based_on, risks, next_step, confidence, sources}
    Format per spec §J.
    """
    title = decision.title
    health = challenge_result.get("health", "supported")
    concerns = challenge_result.get("concerns", [])

    if health == "supported":
        what = f"Proceed with {title}."
        why = "Meeting requirements align well with the chosen approach and external evidence shows no major contradictions."
        confidence = 0.89
        next_step = "Confirm decision and create follow-up actions for implementation with monitoring."
    elif health == "conditional":
        what = f"Proceed with {title} — with conditions."
        why = "Decision is sound but requires operational conditions to mitigate identified risks."
        confidence = 0.76
        next_step = "Use staged migration, establish rollback strategy, and define scaling plan before production."
    elif health == "has_concerns":
        what = f"Proceed with {title} — address concerns first."
        why = "External evidence and constraints surface concerns that should be resolved before full commitment."
        confidence = 0.64
        next_step = "Resolve open questions on scaling and multi-region, then re-review."
    else:  # reconsider
        what = f"Reconsider {title} — evaluate alternatives."
        why = "Multiple concerns (scaling, multi-region, high write) suggest the decision may need alternatives."
        confidence = 0.52
        next_step = "Evaluate alternatives (e.g., MongoDB, Citus) against requirements before confirming."

    # based on meeting context + external
    based_on = f"Meeting evidence: {', '.join((dna.requirements or [])[:2]) or 'transcript evidence'} + {len(external_sources or [])} external sources."

    risks = concerns[:3] if concerns else ["No major risks detected in current context."]

    sources = external_sources[:3] if external_sources else []

    return {
        "what": what,
        "why": why,
        "based_on": based_on,
        "risks": risks,
        "next_step": next_step,
        "confidence": confidence,
        "sources": sources,
        "status": "AI_RECOMMENDATION",
    }
