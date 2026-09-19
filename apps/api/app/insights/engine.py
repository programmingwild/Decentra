import pandas as pd
from typing import List, Dict

def generate_insights(df: pd.DataFrame, dataset_id: str) -> List[Dict]:
    insights = []
    nums = df.select_dtypes(include=["number"]).columns.tolist()
    # trend insight: simple linear trend on first numeric col with datetime
    date_col = None
    for c in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[c]):
            date_col = c
            break
        if df[c].dtype == object:
            try:
                parsed = pd.to_datetime(df[c], errors="coerce")
                if parsed.notna().mean() > 0.8:
                    date_col = c
                    df = df.copy()
                    df[date_col] = pd.to_datetime(df[c], errors="coerce")
                    break
            except Exception:
                continue
    if date_col and nums:
        tmp = df[[date_col, nums[0]]].dropna().sort_values(date_col)
        if len(tmp) >= 4:
            # simple slope
            y = tmp[nums[0]].values
            x = range(len(y))
            # linear slope via polyfit
            try:
                import numpy as np
                slope = np.polyfit(x, y, 1)[0]
                if abs(slope) > 0.05 * abs(y.mean() if y.mean() != 0 else 1):
                    direction = "increasing" if slope > 0 else "decreasing"
                    insights.append({
                        "category": "TREND",
                        "title": f"{nums[0]} is {direction}",
                        "summary": f"{nums[0]} shows a {direction} trend over {date_col} (slope {slope:.2f}).",
                        "severity": "medium" if abs(slope) < 0.2 * abs(y.mean()) else "high",
                        "evidence": {"slope": float(slope), "first": float(y[0]), "last": float(y[-1])},
                        "explanation": {"what": f"{nums[0]} trend", "why": "Linear fit over time", "limitations": "Correlation does not imply causation."},
                    })
            except Exception:
                pass

    # performance: low values
    for col in nums[:2]:
        s = df[col].dropna()
        if s.empty:
            continue
        q10 = s.quantile(0.1)
        low_count = int((s <= q10).sum())
        if low_count > 0 and low_count < len(s) * 0.2:
            insights.append({
                "category": "PERFORMANCE",
                "title": f"Low {col} values detected",
                "summary": f"{low_count} records fall in the bottom 10% of {col} (≤ {q10:.2f}).",
                "severity": "medium",
                "evidence": {"threshold": float(q10), "count": low_count},
                "explanation": {"what": "Bottom decile concentration", "why": "Distribution analysis", "limitations": "May be expected variance."},
            })

    # risk: high missing
    for c in df.columns:
        miss = df[c].isna().mean()
        if miss > 0.15:
            insights.append({
                "category": "RISK",
                "title": f"High missing data in {c}",
                "summary": f"{c} has {miss*100:.1f}% missing values.",
                "severity": "high" if miss > 0.3 else "medium",
                "evidence": {"missing_pct": float(miss*100)},
                "explanation": {"what": "Data completeness issue", "why": "Missing value profiling", "limitations": "Imputation strategy needed."},
            })

    # cap
    return insights[:10]
