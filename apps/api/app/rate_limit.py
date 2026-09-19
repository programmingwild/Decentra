"""Shared rate limiter instance.

Lives outside app.main so route modules can import it without
creating a circular import (app.main imports the routers).

Storage: per-process memory by default. Set RATE_LIMIT_STORAGE_URI
(e.g. redis://redis:6379) so limits hold across uvicorn workers —
otherwise N workers multiply every bucket by N.
"""
import logging

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config.settings import get_settings

log = logging.getLogger("decentra")
settings = get_settings()

_kwargs: dict = {}
if settings.rate_limit_storage_uri:
    _kwargs["storage_uri"] = settings.rate_limit_storage_uri
    log.info("Rate limits shared via %s", settings.rate_limit_storage_uri.split("@")[-1])
else:
    log.info("Rate limits are per-process memory (set RATE_LIMIT_STORAGE_URI=redis://… for multi-worker)")

limiter = Limiter(key_func=get_remote_address, **_kwargs)
