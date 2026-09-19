import os, pandas as pd
from pathlib import Path

def load_dataframe(storage_path: str) -> pd.DataFrame:
    p = Path(storage_path)
    if not p.exists():
        raise FileNotFoundError(f"Storage file not found: {storage_path}")
    if p.suffix == ".parquet":
        try:
            return pd.read_parquet(p)
        except Exception:
            pass
    # fallback csv
    if p.suffix == ".csv":
        return pd.read_csv(p)
    # try both
    try:
        return pd.read_parquet(p)
    except Exception:
        return pd.read_csv(p)
