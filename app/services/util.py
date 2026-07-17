from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from app.services.client_ip import client_ip, request_meta


def new_wrap_id() -> str:
    return secrets.token_urlsafe(18).replace("-", "").replace("_", "")[:24]


def expires_at_from_ttl(ttl_seconds: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)


__all__ = ["client_ip", "request_meta", "new_wrap_id", "expires_at_from_ttl"]
