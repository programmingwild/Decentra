import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest

def zscore_anomalies(series: pd.Series, threshold: float = 3.0):
    s = series.dropna()
    if s.empty or s.std() == 0:
        return []
    z = (s - s.mean()) / s.std()
    mask = z.abs() > threshold
    out = []
    for idx in s[mask].index:
        val = float(s.loc[idx])
        mean = float(s.mean())
        std = float(s.std())
        out.append({
            "index": int(idx) if isinstance(idx, (int, np.integer)) else str(idx),
            "value": val,
            "expected_min": mean - threshold * std,
            "expected_max": mean + threshold * std,
            "deviation_pct": round((val - mean) / abs(mean) * 100, 2) if mean != 0 else None,
            "z": float(z.loc[idx]),
            "method": "zscore",
        })
    return out

def iqr_anomalies(series: pd.Series):
    s = series.dropna()
    if len(s) < 4:
        return []
    q1, q3 = s.quantile(0.25), s.quantile(0.75)
    iqr = q3 - q1
    low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    mask = (s < low) | (s > high)
    out = []
    for idx in s[mask].index:
        val = float(s.loc[idx])
        out.append({
            "index": int(idx) if isinstance(idx, (int, np.integer)) else str(idx),
            "value": val,
            "expected_min": float(low),
            "expected_max": float(high),
            "deviation_pct": round((val - s.median()) / abs(s.median()) * 100, 2) if s.median() != 0 else None,
            "method": "iqr",
        })
    return out

def isolation_forest_anomalies(df: pd.DataFrame, contamination: float = 0.05):
    nums = df.select_dtypes(include=[np.number]).dropna()
    if nums.empty or len(nums) < 10 or nums.shape[1] == 0:
        return []
    try:
        clf = IsolationForest(contamination=contamination, random_state=42)
        preds = clf.fit_predict(nums)
        scores = clf.decision_function(nums)
        out = []
        for i, (p, sc) in enumerate(zip(preds, scores)):
            if p == -1:
                idx = nums.index[i]
                # pick first numeric column as representative value
                col = nums.columns[0]
                val = float(nums.iloc[i][col])
                out.append({
                    "index": int(idx) if isinstance(idx, (int, np.integer)) else str(idx),
                    "value": val,
                    "score": float(sc),
                    "method": "isolation_forest",
                })
        return out
    except Exception:
        return []

def detect_anomalies(df: pd.DataFrame):
    results = []
    for col in df.select_dtypes(include=[np.number]).columns:
        zs = zscore_anomalies(df[col])
        for r in zs:
            r["column"] = str(col)
            results.append(r)
        iqr = iqr_anomalies(df[col])
        for r in iqr:
            r["column"] = str(col)
            # de-duplicate with zscore on same index
            if not any(x["column"] == r["column"] and x["index"] == r["index"] for x in results):
                results.append(r)
    # isolation forest on multivariate
    iso = isolation_forest_anomalies(df)
    for r in iso:
        if "column" not in r:
            r["column"] = str(df.select_dtypes(include=[np.number]).columns[0]) if len(df.select_dtypes(include=[np.number]).columns) else "multivariate"
        results.append(r)
    # limit
    return results[:100]
