import pandas as pd
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.entities import DataQualityReport, DatasetColumn

def compute_quality(df: pd.DataFrame, columns_meta=None) -> dict:
    n_rows, n_cols = df.shape
    total_cells = n_rows * n_cols if n_rows * n_cols > 0 else 1

    missing = int(df.isna().sum().sum())
    completeness = 1 - (missing / total_cells) if total_cells else 1.0

    duplicate_rows = int(df.duplicated().sum())
    uniqueness = 1 - (duplicate_rows / n_rows) if n_rows else 1.0

    # validity: try to detect invalid values per dtype
    invalid = 0
    for col in df.columns:
        series = df[col]
        # for numeric columns, count non-numeric strings that were coerced? Already typed
        # simple: count infinities
        if pd.api.types.is_numeric_dtype(series):
            invalid += int(np.isinf(series.fillna(0)).sum())
    validity = 1 - (invalid / total_cells) if total_cells else 1.0

    # consistency: heuristic — columns with mixed types / high cardinality string inconsistency
    # For now, high consistency unless many outliers
    consistency = 0.95
    # penalize if many columns have high nulls
    high_null_cols = sum(1 for c in df.columns if df[c].isna().mean() > 0.3)
    if high_null_cols > 0:
        consistency -= 0.05 * high_null_cols
        consistency = max(0.5, consistency)

    score = round((0.4 * completeness + 0.25 * validity + 0.2 * uniqueness + 0.15 * consistency) * 100, 1)

    # details
    numeric_stats = {}
    for col in df.select_dtypes(include=[np.number]).columns:
        s = df[col]
        numeric_stats[str(col)] = {
            "mean": float(s.mean()),
            "median": float(s.median()),
            "min": float(s.min()),
            "max": float(s.max()),
            "std": float(s.std()) if len(s) > 1 else 0.0,
            "q25": float(s.quantile(0.25)),
            "q75": float(s.quantile(0.75)),
        }

    # outlier profiling (IQR)
    outliers = {}
    for col in df.select_dtypes(include=[np.number]).columns:
        s = df[col].dropna()
        if len(s) < 4:
            continue
        q1, q3 = s.quantile(0.25), s.quantile(0.75)
        iqr = q3 - q1
        low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        cnt = int(((s < low) | (s > high)).sum())
        if cnt > 0:
            outliers[str(col)] = {"count": cnt, "low": float(low), "high": float(high)}

    details = {
        "row_count": int(n_rows),
        "column_count": int(n_cols),
        "missing_values": int(missing),
        "duplicate_rows": int(duplicate_rows),
        "invalid_values": int(invalid),
        "numeric_stats": numeric_stats,
        "outliers": outliers,
        "columns": [
            {"name": str(c), "dtype": str(df[c].dtype), "nulls": int(df[c].isna().sum()), "uniques": int(df[c].nunique(dropna=True))}
            for c in df.columns
        ],
    }

    return {
        "score": score,
        "completeness": round(completeness * 100, 1),
        "validity": round(validity * 100, 1),
        "uniqueness": round(uniqueness * 100, 1),
        "consistency": round(consistency * 100, 1),
        "details": details,
    }

async def generate_quality_report(dataset_id: str, df: pd.DataFrame, db: AsyncSession):
    q = compute_quality(df)
    report = DataQualityReport(
        dataset_id=dataset_id,
        score=q["score"],
        completeness=q["completeness"],
        validity=q["validity"],
        uniqueness=q["uniqueness"],
        consistency=q["consistency"],
        details=q["details"],
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report
