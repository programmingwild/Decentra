import os, uuid, pathlib, io
import logging
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.entities import Dataset, DatasetColumn
from app.config.settings import get_settings

log = logging.getLogger("decentra.ingestion")

settings = get_settings()

ALLOWED_EXT = {".csv", ".xlsx", ".xls"}

def validate_file(filename: str, size: int):
    ext = pathlib.Path(filename.lower()).suffix
    if ext not in ALLOWED_EXT:
        raise ValueError(f"Unsupported file type {ext}. Allowed: {ALLOWED_EXT}")
    if size > settings.max_upload_mb * 1024 * 1024:
        raise ValueError(f"File too large (max {settings.max_upload_mb}MB)")

def infer_dtype(series: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    if pd.api.types.is_integer_dtype(series):
        return "integer"
    if pd.api.types.is_float_dtype(series):
        return "float"
    # try datetime parse for object
    if series.dtype == object:
        try:
            pd.to_datetime(series.dropna().head(20), errors="raise")
            # if succeeds for sample, treat as datetime candidate but keep string if ambiguous
            # we check if at least 80% parseable
            parsed = pd.to_datetime(series.dropna(), errors="coerce")
            if parsed.notna().mean() > 0.8:
                return "datetime"
        except Exception:
            pass
        # categorical heuristic
        if series.nunique() / max(len(series), 1) < 0.5 and series.nunique() < 50:
            return "categorical"
        return "string"
    return "string"

async def process_upload(file_bytes: bytes, filename: str, org_id: str, user_id: str, name: str, description: str, db: AsyncSession):
    validate_file(filename, len(file_bytes))
    ext = pathlib.Path(filename).suffix.lower()
    # parse
    try:
        if ext == ".csv":
            # handle encoding
            try:
                df = pd.read_csv(io.BytesIO(file_bytes))
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding="latin1")
        else:
            df = pd.read_excel(io.BytesIO(file_bytes))
    except Exception as e:
        # Never echo parser internals (paths, versions) to the client.
        log.warning("Upload parse failed: %s", e)
        raise ValueError("Failed to parse file: unsupported content or corrupt data")

    if df.empty:
        raise ValueError("Dataset is empty")
    if len(df.columns) == 0:
        raise ValueError("No columns found")
    # trim
    df.columns = [str(c).strip() for c in df.columns]
    # limit rows for storage sanity (keep all but warn if huge)
    if len(df) > 200_000:
        raise ValueError("Dataset too large (max 200k rows)")

    # storage: save parquet/csv artifact
    os.makedirs(settings.storage_path, exist_ok=True)
    storage_name = f"{uuid.uuid4().hex}.parquet"
    storage_path = os.path.join(settings.storage_path, storage_name)
    # save parquet if possible, else csv
    try:
        df.to_parquet(storage_path, index=False)
    except Exception:
        # fallback csv
        storage_name = storage_name.replace(".parquet", ".csv")
        storage_path = os.path.join(settings.storage_path, storage_name)
        df.to_csv(storage_path, index=False)

    dataset = Dataset(
        org_id=org_id, name=name or pathlib.Path(filename).stem,
        description=description, source_type=ext.lstrip("."), storage_path=storage_path,
        file_size_bytes=len(file_bytes), row_count=len(df), column_count=len(df.columns),
        status="ready", uploaded_by=user_id
    )
    db.add(dataset)
    await db.flush()

    # columns metadata
    for i, col in enumerate(df.columns):
        series = df[col]
        null_count = int(series.isna().sum())
        unique_count = int(series.nunique(dropna=True))
        dtype = infer_dtype(series)
        stats = {}
        if dtype in ("integer", "float"):
            stats = {
                "mean": float(series.mean()) if not series.empty else None,
                "median": float(series.median()) if not series.empty else None,
                "min": float(series.min()) if not series.empty else None,
                "max": float(series.max()) if not series.empty else None,
                "std": float(series.std()) if not series.empty else None,
            }
        elif dtype == "datetime":
            try:
                dt = pd.to_datetime(series, errors="coerce")
                stats = {"min": str(dt.min()), "max": str(dt.max())}
            except Exception:
                pass
        else:
            # top values
            top = series.value_counts(dropna=True).head(5).to_dict()
            stats = {"top_values": {str(k): int(v) for k, v in top.items()}}

        dc = DatasetColumn(dataset_id=dataset.id, name=str(col), dtype=dtype, position=i, null_count=null_count, unique_count=unique_count, stats=stats)
        db.add(dc)

    await db.commit()
    await db.refresh(dataset)
    return dataset, df
