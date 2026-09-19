import pandas as pd
from typing import Dict, Any
from app.analytics.engine import describe_numeric, correlation_matrix, trends, segmentation, kpi_candidates
from app.ml.anomaly import detect_anomalies
from app.ml.forecast import forecast_series

def route_intent(question: str) -> str:
    q = question.lower()
    if any(k in q for k in ["why", "decline", "decrease", "drop", "fall", "reason"]):
        return "explain_change"
    if any(k in q for k in ["best", "top", "highest", "which region", "which product", "perform"]):
        return "segmentation"
    if any(k in q for k in ["anomaly", "unusual", "outlier", "strange"]):
        return "anomaly"
    if any(k in q for k in ["predict", "forecast", "next", "future"]):
        return "forecast"
    if any(k in q for k in ["correlat", "relationship", "related"]):
        return "correlation"
    if any(k in q for k in ["trend", "over time", "change"]):
        return "trend"
    return "general"

def build_evidence(question: str, df: pd.DataFrame, dataset_name: str = "") -> tuple[str, Dict[str, Any]]:
    intent = route_intent(question)
    evidence: Dict[str, Any] = {}
    evidence_list = []

    if intent in ("explain_change", "trend", "general"):
        kpis = kpi_candidates(df)
        evidence["kpis"] = kpis
        for k in kpis[:3]:
            evidence_list.append({"type": "kpi", "name": k["name"], "value": k["value"], "previous": k.get("previous_value"), "change_pct": k.get("change_pct"), "status": k.get("status")})
        tr = trends(df)
        evidence["trends"] = tr
        if tr.get("series"):
            for col, pts in list(tr["series"].items())[:2]:
                evidence_list.append({"type": "trend", "column": col, "points": pts[-4:]})
        seg = segmentation(df)
        evidence["segmentation"] = seg
        if seg.get("segments"):
            for dim, rows in list(seg["segments"].items())[:1]:
                evidence_list.append({"type": "segmentation", "dimension": dim, "top_groups": rows[:3]})

    if intent == "segmentation":
        seg = segmentation(df)
        evidence["segmentation"] = seg
        if seg.get("segments"):
            for dim, rows in seg["segments"].items():
                evidence_list.append({"type": "segmentation", "dimension": dim, "groups": rows})

    if intent == "anomaly":
        anomalies = detect_anomalies(df)
        evidence["anomalies"] = anomalies[:10]
        for a in anomalies[:5]:
            evidence_list.append({"type": "anomaly", "column": a.get("column"), "value": a.get("value"), "expected": [a.get("expected_min"), a.get("expected_max")], "method": a.get("method")})

    if intent == "forecast":
        fc = forecast_series(df)
        evidence["forecast"] = fc
        if fc:
            evidence_list.append({"type": "forecast", "target": fc.get("target"), "next": fc["forecast"][0] if fc.get("forecast") else None, "evaluation": fc.get("evaluation")})

    if intent == "correlation":
        corr = correlation_matrix(df)
        evidence["correlation"] = corr
        evidence_list.append({"type": "correlation", "matrix": corr})

    if not evidence:
        # fallback: provide summary stats
        desc = describe_numeric(df)
        evidence["summary"] = desc
        evidence_list.append({"type": "summary", "numeric_stats": desc})

    evidence["evidence_list"] = evidence_list
    evidence["intent"] = intent
    return intent, evidence

def dataset_context(df: pd.DataFrame, dataset_name: str, columns: list) -> Dict[str, Any]:
    return {
        "dataset_name": dataset_name,
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": columns,
        "dtypes": {str(c): str(df[c].dtype) for c in df.columns},
    }
