"""Regression: forecast_series must auto-detect date columns regardless of
how pandas stores strings (object dtype in pandas 2, str dtype in pandas 3).
Without this, /predictions returns 'Insufficient time-series data' on the
demo dataset even though it holds 24 months of history.
"""
import pandas as pd

from app.ml.forecast import forecast_series


def _monthly_frame(n_months=12):
    dates = pd.date_range("2023-01-01", periods=n_months, freq="MS")
    rows = []
    for d in dates:
        for region in ("North", "South"):
            rows.append({"date": d.strftime("%Y-%m-%d"), "region": region,
                         "revenue": 100000.0 + len(rows)})
    return pd.DataFrame(rows)


def test_forecast_detects_str_dtype_dates():
    df = _monthly_frame()
    fc = forecast_series(df, horizon=3)
    assert fc is not None
    assert fc["target"] == "revenue"
    assert len(fc["forecast"]) == 3
    assert len(fc["history"]) == 12


def test_forecast_detects_object_dtype_dates():
    df = _monthly_frame().astype({"date": object})
    assert df["date"].dtype == object
    fc = forecast_series(df, horizon=3)
    assert fc is not None
    assert len(fc["forecast"]) == 3
