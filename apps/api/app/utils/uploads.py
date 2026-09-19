"""Upload helpers: never buffer an unbounded body into RAM."""
from fastapi import UploadFile


async def read_upload_capped(file: UploadFile, cap_bytes: int, label: str = "File") -> bytes:
    """Stream an UploadFile in 1MB chunks, aborting past cap_bytes.

    Raises ValueError (mapped to 400/413 by callers) instead of letting a
    hostile client OOM the worker by sending gigabytes before validation.
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > cap_bytes:
            raise ValueError(f"{label} too large (max {cap_bytes // (1024 * 1024)}MB)")
        chunks.append(chunk)
    return b"".join(chunks)
