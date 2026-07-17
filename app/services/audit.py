from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditEvent

KNOWN_AUDIT_EVENT_TYPES = [
    "wrap.create",
    "wrap.unwrap",
    "admin.login",
    "admin.logout",
    "admin.settings_update",
    "admin.purge",
]


async def write_audit(
    db: AsyncSession,
    *,
    event_type: str,
    success: bool,
    wrap_id: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    accept_language: str | None = None,
    forwarded_for: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    event = AuditEvent(
        event_type=event_type,
        success=success,
        wrap_id=wrap_id,
        ip=ip,
        user_agent=(user_agent or "")[:512] or None,
        accept_language=(accept_language or "")[:128] or None,
        forwarded_for=(forwarded_for or "")[:256] or None,
        details=details or {},
    )
    db.add(event)
    await db.commit()


async def purge_old_audit(db: AsyncSession, retention_days: int) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    result = await db.execute(delete(AuditEvent).where(AuditEvent.created_at < cutoff))
    await db.commit()
    return result.rowcount or 0


def _audit_filters(event_type: str | None, wrap_id: str | None):
    filters = []
    if event_type:
        filters.append(AuditEvent.event_type == event_type)
    if wrap_id:
        filters.append(AuditEvent.wrap_id == wrap_id)
    return filters


async def list_audit(
    db: AsyncSession,
    *,
    limit: int = 100,
    offset: int = 0,
    event_type: str | None = None,
    wrap_id: str | None = None,
) -> list[AuditEvent]:
    stmt = select(AuditEvent).order_by(AuditEvent.created_at.desc()).offset(offset).limit(limit)
    for f in _audit_filters(event_type, wrap_id):
        stmt = stmt.where(f)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def count_audit(
    db: AsyncSession,
    *,
    event_type: str | None = None,
    wrap_id: str | None = None,
) -> int:
    stmt = select(func.count()).select_from(AuditEvent)
    for f in _audit_filters(event_type, wrap_id):
        stmt = stmt.where(f)
    result = await db.execute(stmt)
    return int(result.scalar_one() or 0)


async def list_audit_event_types(db: AsyncSession) -> list[str]:
    """Known types plus distinct values already stored in DB (dynamic dropdown)."""
    result = await db.execute(
        select(AuditEvent.event_type).distinct().order_by(AuditEvent.event_type)
    )
    from_db = [row[0] for row in result.all() if row[0]]
    return sorted(set(KNOWN_AUDIT_EVENT_TYPES) | set(from_db))
