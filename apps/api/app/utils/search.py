import re
from collections import Counter

STOP = {"what","did","the","about","we","to","do","is","are","for","and","or","a","an","in","on","of","with","about","you","your","my","our","was","were","been","be","have","has","had","will","would","should","could","can","may","might","this","that","these","those","it","its","as","at","by","from","are","was"}

def tokenize(text: str) -> list[str]:
    if not text: return []
    toks = [t for t in re.findall(r"[a-z0-9]{2,}", text.lower()) if len(t) > 1]
    return [t for t in toks if t not in STOP]

def bm25_score(query_tokens: list[str], doc_tokens: list[str], doc_len: int, avg_len: float, k1: float = 1.2, b: float = 0.75) -> float:
    if not query_tokens or not doc_tokens: return 0.0
    q_counts = Counter(query_tokens)
    d_counts = Counter(doc_tokens)
    score = 0.0
    for tok, qf in q_counts.items():
        tf = d_counts.get(tok, 0)
        # partial/stem fallback: "decide" vs "decided", "agree" vs "agreed"
        if tf == 0:
            for dtok, cnt in d_counts.items():
                if len(tok) >= 4 and len(dtok) >= 4 and (dtok.startswith(tok) or tok.startswith(dtok) or tok in dtok or dtok in tok):
                    tf = cnt * 0.6
                    break
        if tf == 0: continue
        idf = 1.0
        numerator = tf * (k1 + 1)
        denom = tf + k1 * (1 - b + b * (doc_len / avg_len if avg_len else 1))
        score += idf * (numerator / denom) * qf
    query_phrase = " ".join(query_tokens)
    doc_phrase = " ".join(doc_tokens)
    if query_phrase and query_phrase in doc_phrase:
        score *= 1.4
    return score

def search_candidates(query: str, docs: list[dict], text_key: str = "text", limit: int = 6):
    """
    docs: list of {id, text, ...}
    Returns top `limit` scored docs with _score.
    Safe, deterministic, no external calls.
    """
    qtok = tokenize(query)
    if not qtok or not docs:
        return []
    # pre-tokenize
    tokenized = []
    total_len = 0
    for d in docs:
        toks = tokenize(d.get(text_key, "") or "")
        tokenized.append(toks)
        total_len += len(toks)
    avg_len = total_len / max(len(docs), 1)
    scored = []
    for d, toks in zip(docs, tokenized):
        s = bm25_score(qtok, toks, len(toks), avg_len)
        # small boost if query token appears in title vs body? handled via text_key
        if s > 0:
            scored.append({**d, "_score": s})
    scored.sort(key=lambda x: x["_score"], reverse=True)
    return scored[:limit]
