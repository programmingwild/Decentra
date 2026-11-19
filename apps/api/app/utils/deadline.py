import re
from datetime import datetime, timedelta, timezone

def _now() -> datetime:
    # naive UTC, matching SQLAlchemy DateTime columns elsewhere in the app
    return datetime.now(timezone.utc).replace(tzinfo=None)

def _naive(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None) if getattr(dt, "tzinfo", None) else dt

WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

def parse_deadline_raw(raw: str | None, from_dt: datetime | None = None) -> datetime | None:
    if not raw:
        return None
    t = raw.strip().lower()
    if not t:
        return None
    if from_dt is None:
        from_dt = _now()
    # normalize to naive date for calculation
    base = _naive(from_dt)
    # ISO YYYY-MM-DD
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", t)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except: return None
    if re.match(r"^(today|now)$", t):
        return base
    if re.match(r"^tomorrow$", t):
        return base + timedelta(days=1)
    if "next week" in t:
        return base + timedelta(days=7)
    if re.match(r"end of (the )?week", t):
        # Friday = 4 (Mon=0)
        # Python weekday Mon=0, need mapping Sun=6 in our WEEKDAYS
        # Convert base weekday to 0=Sunday
        # Simpler: target Friday
        days_ahead = (4 - base.weekday() - 1) % 7  # Friday offset
        # Actually Friday weekday=4 (Mon=0) => 4
        delta = (4 - base.weekday()) % 7
        if delta == 0: delta = 0
        return base + timedelta(days=delta)
    if re.match(r"end of (the )?month", t):
        # last day of month
        year, month = base.year, base.month
        if month == 12:
            nxt = datetime(year+1, 1, 1)
        else:
            nxt = datetime(year, month+1, 1)
        return nxt - timedelta(days=1)
    # weekdays
    for i, name in enumerate(WEEKDAYS):
        # i 0=Sunday, 1=Monday... but python weekday Monday=0 -> Sunday=6
        # Map i to python weekday: Sunday 6, Monday 0, etc.
        py_weekday = (i + 6) % 7
        if re.match(rf"^(this |next )?{name}$", t) or re.match(rf"^(this |next )?{name[:3]}$", t):
            delta = (py_weekday - base.weekday()) % 7
            if delta == 0:
                delta = 7
            return base + timedelta(days=delta)
    m = re.match(r"^(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?$", t)
    if m:
        try:
            y = int(m.group(3)) if m.group(3) else base.year
            if y < 100: y += 2000
            return datetime(y, int(m.group(1)), int(m.group(2)))
        except: return None
    # try dateutil fallback for anything like "Aug 30, 2026"
    try:
        from dateutil import parser as dparser
        dt = dparser.parse(raw, fuzzy=True, default=base)
        # only accept if raw contains a date-like token
        if re.search(r"\d{4}|\d{1,2}[/-]\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec", t, re.I):
            return _naive(dt)
    except: pass
    return None

def fmt_deadline_status(raw: str | None):
    due = parse_deadline_raw(raw)
    if not due:
        return {"label": raw or "", "due": None, "overdue": False, "today": False}
    now = _now()
    def start_of(d): return datetime(d.year, d.month, d.day)
    diff = (start_of(due) - start_of(now)).days
    if diff == 0: label = "Today"
    elif diff == 1: label = "Tomorrow"
    elif diff == -1: label = "1 day late"
    elif diff < 0: label = f"{abs(diff)} days late"
    else: label = due.strftime("%b %d")
    return {"label": label, "due": due, "overdue": diff < 0, "today": diff == 0}
