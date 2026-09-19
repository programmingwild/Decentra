from typing import List, Dict

def build_recommendations(insights: List[Dict], anomalies: List[Dict]) -> List[Dict]:
    recs = []
    for ins in insights:
        cat = ins.get("category")
        title = ins.get("title", "")
        if cat == "TREND" and "decreasing" in title.lower():
            recs.append({
                "observation": title,
                "evidence": ins.get("evidence"),
                "interpretation": "Evidence suggests a sustained decline; consider investigating contributing segments.",
                "action": "Consider investigating top contributing dimensions (region/product/channel) and recent anomalies.",
                "priority": "high",
            })
        elif cat == "RISK":
            recs.append({
                "observation": title,
                "evidence": ins.get("evidence"),
                "interpretation": "Data quality risk may affect downstream decisions.",
                "action": "Prioritize reviewing data collection for this column and consider remediation.",
                "priority": "medium",
            })
        elif cat == "PERFORMANCE":
            recs.append({
                "observation": title,
                "evidence": ins.get("evidence"),
                "interpretation": "Potential underperformance cluster.",
                "action": "Prioritize reviewing bottom-decile records for operational causes.",
                "priority": "medium",
            })
    for a in anomalies[:3]:
        recs.append({
            "observation": f"Anomaly in {a.get('column')} at index {a.get('index')}",
            "evidence": a,
            "interpretation": f"Observed {a.get('value')} vs expected {a.get('expected_min')}–{a.get('expected_max')} ({a.get('method')}).",
            "action": "Consider investigating this record for data error or genuine event.",
            "priority": "high",
        })
    # de-dupe + cap
    seen = set()
    out = []
    for r in recs:
        key = r["observation"]
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
        if len(out) >= 8:
            break
    return out
