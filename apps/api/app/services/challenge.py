import logging
from app.models.entities import Decision, DecisionDNA

log = logging.getLogger("decentra.challenge")

async def challenge_decision(decision: Decision, dna: DecisionDNA, context: dict, external_sources: list) -> dict:
    """
    Returns {health: supported|has_concerns|conditional|reconsider, concerns: [], questions: []}
    Never overturns human decision — just intelligence.
    """
    title = decision.title.lower()
    evidence = " ".join((dna.requirements or []) + (dna.constraints or [])).lower()
    has_scaling = "scale" in evidence or "traffic" in evidence or "postgres" in title
    has_multi_region = "geographic" in evidence or "region" in evidence or "expansion" in evidence
    has_high_write = "write volume" in evidence or "high write" in evidence

    concerns = []
    questions = []
    health = "supported"

    if has_scaling and "postgres" in title:
        concerns.append("PostgreSQL at high write volume may require partitioning and pooling")
        questions.append("What is the expected write workload and scaling strategy?")
        health = "conditional"

    if has_multi_region:
        concerns.append("Multi-region PostgreSQL needs careful replication strategy")
        questions.append("How will multi-region writes and failover work?")
        if health == "supported": health = "has_concerns"

    if "scalability" in evidence and not has_scaling:
        concerns.append("Current API scalability risk not addressed by decision")
        questions.append("What is the API scaling plan under chosen decision?")
        health = "has_concerns"

    # check external sources for contradictions
    for src in external_sources or []:
        snippet = (src.get("snippet") or "").lower()
        if "limitation" in snippet and "postgres" in title:
            concerns.append(f"External evidence notes limitation: {src['snippet'][:120]}")
            if health == "supported": health = "has_concerns"

    if not concerns:
        concerns = []
        questions = []

    # final health mapping
    if len(concerns) >= 2 and has_high_write and has_multi_region:
        health = "reconsider"
    elif len(concerns) == 0:
        health = "supported"

    return {"health": health, "concerns": concerns[:4], "questions": questions[:4]}
