import re
import logging
from enum import Enum

log = logging.getLogger("decentra.privacy")

class Level(str, Enum):
    PUBLIC = "PUBLIC"
    INTERNAL = "INTERNAL"
    CONFIDENTIAL = "CONFIDENTIAL"
    HIGHLY_SENSITIVE = "HIGHLY_SENSITIVE"
    SECRET = "SECRET"

# detection patterns
PATTERNS = {
    Level.SECRET: [
        r"(?i)(api[_-]?key|secret|token)\s*[:=]\s*['\"]?[A-Za-z0-9_\-]{16,}",
        r"(?i)password\s*[:=]\s*['\"]?[^'\"]{6,}",
        r"sk-[A-Za-z0-9]{20,}",
        r"(?i)aws[_-]?access[_-]?key",
    ],
    Level.HIGHLY_SENSITIVE: [
        r"\b\d{3}-\d{2}-\d{4}\b",  # SSN
        r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b",  # card
        r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
        r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b",  # phone
    ],
    Level.CONFIDENTIAL: [
        r"(?i)customer.*\b\d+\b",
        r"(?i)account\s*(id|number)\s*[:=]",
        r"https?://[^\s]*internal[^\s]*",
    ],
}

PRIVACY_MODES = {"MAXIMUM", "BALANCED", "RESEARCH"}

def classify(text: str) -> Level:
    if not text: return Level.PUBLIC
    for level in [Level.SECRET, Level.HIGHLY_SENSITIVE, Level.CONFIDENTIAL]:
        for pat in PATTERNS[level]:
            if re.search(pat, text):
                return level
    # heuristic: if contains names + financial
    if re.search(r"(?i)\b(customer|financial|revenue|\$)\b", text) and re.search(r"\b[A-Z][a-z]+ [A-Z][a-z]+\b", text):
        return Level.CONFIDENTIAL
    if re.search(r"\b\d+\b", text) and len(text) > 80:
        return Level.INTERNAL
    return Level.PUBLIC

def sanitize(text: str, mode: str = "BALANCED") -> str:
    if not text: return text
    if mode == "MAXIMUM":
        return "[REDACTED - Maximum Privacy]"
    # remove secrets
    sanitized = text
    # emails -> [email]
    sanitized = re.sub(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[email]", sanitized, flags=re.I)
    # phones
    sanitized = re.sub(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", "[phone]", sanitized)
    # api keys/tokens
    sanitized = re.sub(r"(?i)(api[_-]?key|secret|token)\s*[:=]\s*['\"]?[A-Za-z0-9_\-]{16,}['\"]?", r"\1=[REDACTED]", sanitized)
    # urls with internal
    sanitized = re.sub(r"https?://[^\s]*", "[url]", sanitized)
    # names: keep first name only? For Balanced, keep first name, redact last
    if mode == "BALANCED":
        # keep first names of participants? For now, keep as is but redact emails already
        pass
    # for HIGHLY_SENSITIVE/SECRET, block entirely
    level = classify(text)
    if level in (Level.SECRET, Level.HIGHLY_SENSITIVE) and mode != "RESEARCH":
        log.warning(f"Blocked {level} from external research")
        return "[REDACTED - Sensitive content blocked]"
    return sanitized

def generate_research_query(decision_title: str, context: dict, sanitized: bool = True) -> str:
    # context: {primary_theme, requirements, constraints, affected_systems}
    ctx_parts = []
    if context.get("primary_theme"): ctx_parts.append(f"Context: {context['primary_theme']}")
    if context.get("requirements"): ctx_parts.append(f"Requirements: {', '.join(context['requirements'][:3])}")
    if context.get("constraints"): ctx_parts.append(f"Constraints: {', '.join(context['constraints'][:3])}")
    query = f"Evaluate {decision_title} for {'; '.join(ctx_parts)}. Identify best practices, risks, limitations, alternatives and architecture considerations."
    if sanitized:
        query = sanitize(query, mode="BALANCED")
    return query[:500]
