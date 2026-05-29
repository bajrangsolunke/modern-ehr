"""Shared slowapi limiter. Kept in a dedicated module so endpoint
files can apply `@limiter.limit("...")` without importing main.py
(which would create a circular dependency)."""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
)
