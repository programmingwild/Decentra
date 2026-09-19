import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

def forecast_series(df: pd.DataFrame, date_col: str = None, target_col: str = None, horizon: int = 6):
    # auto-detect date and target
    if date_col is None:
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
                        df[date_col] = parsed
                        break
                except Exception:
                    continue
    if target_col is None:
        nums = df.select_dtypes(include=[np.number]).columns.tolist()
        if not nums:
            return None
        target_col = nums[0]

    if date_col is None or target_col is None:
        return None

    tmp = df[[date_col, target_col]].copy()
    tmp[date_col] = pd.to_datetime(tmp[date_col], errors="coerce")
    tmp = tmp.dropna(subset=[date_col, target_col]).sort_values(date_col)
    if len(tmp) < 6:
        return None

    # aggregate by month
    try:
        monthly = tmp.groupby(tmp[date_col].dt.to_period("M"))[target_col].sum().reset_index()
        monthly[date_col] = monthly[date_col].dt.to_timestamp()
    except Exception:
        monthly = tmp

    monthly = monthly.sort_values(date_col).reset_index(drop=True)
    # features: time index
    X = np.arange(len(monthly)).reshape(-1, 1)
    y = monthly[target_col].values.astype(float)

    # train/test split for evaluation
    split = max(2, len(monthly) - 3)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    model = LinearRegression()
    model.fit(X_train, y_train)

    y_pred_test = model.predict(X_test) if len(X_test) else np.array([])
    mae = float(mean_absolute_error(y_test, y_pred_test)) if len(y_test) else None
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred_test))) if len(y_test) else None

    # forecast horizon
    X_future = np.arange(len(monthly), len(monthly) + horizon).reshape(-1, 1)
    y_future = model.predict(X_future)

    # simple uncertainty: std of residuals
    residuals = y_train - model.predict(X_train)
    std = float(np.std(residuals)) if len(residuals) > 1 else float(np.std(y)) * 0.1

    # future dates
    last_date = monthly[date_col].iloc[-1]
    try:
        future_dates = pd.date_range(start=last_date + pd.offsets.MonthBegin(1), periods=horizon, freq="MS")
    except Exception:
        future_dates = [f"period_{i+1}" for i in range(horizon)]

    results = []
    for i, (d, v) in enumerate(zip(future_dates, y_future)):
        results.append({
            "period": str(d)[:10] if hasattr(d, "strftime") else str(d),
            "predicted": float(v),
            "lower": float(v - 1.96 * std),
            "upper": float(v + 1.96 * std),
        })

    history = [{"period": str(row[date_col])[:10], "value": float(row[target_col])} for _, row in monthly.tail(12).iterrows()]

    return {
        "model": "LinearRegression",
        "target": str(target_col),
        "date_column": str(date_col),
        "horizon": horizon,
        "history": history,
        "forecast": results,
        "evaluation": {"mae": mae, "rmse": rmse, "r2": float(model.score(X_train, y_train)) if len(X_train) > 1 else None},
        "uncertainty_note": "Prediction intervals based on residual standard deviation (95% approx). Actual outcomes may vary.",
    }
