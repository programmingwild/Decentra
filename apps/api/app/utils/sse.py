"""Server-sent events helpers. json.dumps escapes newlines, so every frame
is exactly two lines — the frontend can split on blank lines safely."""
import json


def frame(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",  # nginx: don't buffer the stream
    "Connection": "keep-alive",
}
