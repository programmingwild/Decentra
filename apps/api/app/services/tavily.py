import logging, httpx
from app.services.privacy import Level, classify, sanitize, generate_research_query

log = logging.getLogger("decentra.tavily")

async def external_research(decision_title: str, context: dict, mode: str = "BALANCED", is_live: bool = False):
    """
    Returns {query, sources, summary, status}
    Never sends raw transcript — only sanitized decision context.
    Disabled during live by default.
    """
    if is_live:
        return {"status": "skipped", "reason": "Live meetings do not run external research by default", "query": None, "sources": []}
    if mode == "MAXIMUM":
        return {"status": "skipped", "reason": "Maximum Privacy — no external research", "query": None, "sources": []}

    # classify decision context
    full_context = f"{decision_title} {' '.join(context.get('requirements',[]))} {' '.join(context.get('constraints',[]))}"
    level = classify(full_context)
    if level in (Level.SECRET, Level.HIGHLY_SENSITIVE) and mode != "RESEARCH":
        return {"status": "blocked", "reason": f"Blocked {level} — sanitization required", "query": None, "sources": []}

    query = generate_research_query(decision_title, context, sanitized=True)
    log.info(f"Research query: {query[:120]}")

    # try Tavily if key present
    from app.config.settings import get_settings
    settings = get_settings()
    api_key = getattr(settings, "tavily_api_key", "") or ""
    if not api_key:
        # Honest unavailable: no fabricated sources. Consumers must never
        # mistake canned demo links for real research.
        return {
            "status": "unavailable",
            "query": query,
            "sources": [],
            "summary": "External research is not configured — set TAVILY_API_KEY to enable live sources.",
        }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post("https://api.tavily.com/search", json={"api_key": api_key, "query": query, "search_depth": "advanced", "max_results": 5})
            resp.raise_for_status()
            data = resp.json()
            sources = []
            for r in data.get("results", [])[:5]:
                sources.append({"title": r.get("title",""), "url": r.get("url",""), "snippet": r.get("content","")[:300]})
            return {"status": "success", "query": query, "sources": sources}
    except Exception as e:
        log.warning(f"Tavily failed: {e}")
        return {"status": "error", "query": query, "sources": [], "error": str(e)[:300]}
