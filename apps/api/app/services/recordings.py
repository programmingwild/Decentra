import os, uuid
from pathlib import Path
from app.config.settings import get_settings
settings = get_settings()

ALLOWED_AUDIO = {".mp3", ".wav", ".m4a", ".webm", ".mp4", ".mov", ".ogg"}

def save_recording(file_bytes: bytes, filename: str, meeting_id: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_AUDIO and ext not in {".json", ".txt"}:
        raise ValueError(f"Unsupported audio format '{ext}'. Allowed: {', '.join(sorted(ALLOWED_AUDIO))} or .json for transcript")
    if len(file_bytes) == 0:
        raise ValueError("Empty file — upload a valid audio/video file")
    if len(file_bytes) > settings.max_recording_mb * 1024 * 1024:
        raise ValueError(f"File too large (max {settings.max_recording_mb}MB)")
    os.makedirs(settings.storage_path, exist_ok=True)
    key = f"recordings/{meeting_id}/{uuid.uuid4().hex}{ext}"
    full = Path(settings.storage_path) / key
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_bytes(file_bytes)
    return str(full)
