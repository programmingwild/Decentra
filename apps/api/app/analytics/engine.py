import pandas as pd
import numpy as np
from typing import Dict, Any

def describe_numeric(df: pd.DataFrame) -> Dict[str, Any]:
    nums = df.select_dtypes(include=[np.number])
    out = {}
    for col in nums.columns:
        s = nums[col].dropna()
        if s.empty:
            continue
        out[str(col)] = {
            "count": int(s.count()),
            "mean": float(s.mean()),
            "median": float(s.median()),
            "min": float(s.min()),
            "max": float(s.max()),
            "std": float(s.std()) if len(s) > 1 else 0.0,
            "q25": float(s.quantile(0.25)),
            "q75": float(s.quantile(0.75)),
        }
    return out

def correlation_matrix(df: pd.DataFrame) -> Dict[str, Any]:
    nums = df.select_dtypes(include=[np.number])
    if nums.shape[1] < 2:
        return {}
    corr = nums.corr(numeric_only=True)
    # return as dict
    return corr.round(3).to_dict()

def trends(df: pd.DataFrame) -> Dict[str, Any]:
    # detect datetime column
    date_col = None
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            date_col = col
            break
        # try parse object as datetime
        if df[col].dtype == object:
            try:
                parsed = pd.to_datetime(df[col], errors="coerce")
                if parsed.notna().mean() > 0.8:
                    date_col = col
                    df = df.copy()
                    df[date_col] = parsed
                    break
            except Exception:
                continue
    if date_col is None:
        return {"date_column": None, "series": {}}
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        return {"date_column": str(date_col), "series": {}}
    # sort by date
    df_sorted = df.sort_values(date_col)
    series = {}
    for col in numeric_cols[:5]:  # limit
        g = df_sorted.groupby(pd.Grouper(key=date_col, freq="ME"))[col].sum(numeric_only=True) if pd.api.types.is_datetime64_any_dtype(df_sorted[date_col]) else None
        # Fallback: group by date string
        try:
            grouped = df_sorted.groupby(df_sorted[date_col].dt.to_period("M"))[col].sum()
            series[str(col)] = [{"period": str(k), "value": float(v)} for k, v in grouped.items()]
        except Exception:
            pass
    return {"date_column": str(date_col), "series": series}

def segmentation(df: pd.DataFrame, top_n: int = 5) -> Dict[str, Any]:
    cats = [c for c in df.columns if df[c].dtype == object or str(df[c].dtype) == "category" or df[c].dtype == "string"]
    nums = df.select_dtypes(include=[np.number]).columns.tolist()
    if not cats or not nums:
        return {}
    target = nums[0]
    out = {}
    for cat in cats[:3]:
        g = df.groupby(cat)[target].agg(["sum", "mean", "count"]).sort_values("sum", ascending=False).head(top_n)
        out[str(cat)] = [{"group": str(idx), "sum": float(row["sum"]), "mean": float(row["mean"]), "count": int(row["count"])} for idx, row in g.iterrows()]
    return {"target": target, "segments": out}

def kpi_candidates(df: pd.DataFrame) -> list[dict]:
    kpis = []
    nums = df.select_dtypes(include=[np.number]).columns.tolist()
    date_col = None
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            date_col = col
            break
        if df[col].dtype == object:
            try:
                parsed = pd.to_datetime(df[col], errors="coerce")
                if parsed.notna().mean() > 0.8:
                    date_col = col
                    break
            except Exception:
                continue
    for col in nums[:6]:
        s = df[col].dropna()
        if s.empty:
            continue
        total = float(s.sum())
        mean = float(s.mean())
        # previous value: if date_col exists, compare last two periods
        prev = None
        change_pct = None
        trend = "stable"
        if date_col is not None:
            try:
                tmp = df.copy()
                tmp[date_col] = pd.to_datetime(tmp[date_col], errors="coerce")
                tmp = tmp.sort_values(date_col)
                grouped = tmp.groupby(tmp[date_col].dt.to_period("M"))[col].sum()
                if len(grouped) >= 2:
                    cur = float(grouped.iloc[-1])
                    prev = float(grouped.iloc[-2])
                    if prev != 0:
                        change_pct = round((cur - prev) / abs(prev) * 100, 2)
                    total = cur
                    # trend from last 3
                    if len(grouped) >= 3:
                        vals = grouped.tail(3).tolist()
                        if vals[-1] > vals[0] * 1.05:
                            trend = "up"
                        elif vals[-1] < vals[0] * 0.95:
                            trend = "down"
            except Exception:
                pass
        status = "healthy"
        if change_pct is not None:
            if change_pct < -10:
                status = "attention_required"
            elif change_pct < -5:
                status = "watch"
        kpis.append({
            "name": str(col),
            "value": total,
            "previous_value": prev,
            "change_pct": change_pct,
            "target": round(mean * len(s) * 1.1, 2) if mean else None,
            "status": status,
            "trend": trend,
            "definition": f"Sum of {col}" + (f" (latest period vs previous)" if prev is not None else ""),
        })
    return kpis
