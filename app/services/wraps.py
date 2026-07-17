from __future__ import annotations

import secrets
from datetime import datetime, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Wrap, WrapStatus
from app.services.client_ip import client_ip, request_meta
from app.services.storage import storage


def new_wrap_id() -> str:
    return secrets.token_urlsafe(18).replace("-", "").replace("_", "")[:24]


async def expire_due_wraps(db: AsyncSession) -> int:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Wrap).where(Wrap.status == WrapStatus.pending, Wrap.expires_at <= now)
    )
    rows = list(result.scalars().all())
    for wrap in rows:
        try:
            await storage.delete(wrap.object_key)
        except Exception:
            pass
        wrap.status = WrapStatus.expired
    if rows:
        await db.commit()
    return len(rows)


async def delete_wrap_object(db: AsyncSession, wrap: Wrap) -> None:
    try:
        await storage.delete(wrap.object_key)
    except Exception:
        pass


async def cleanup_expired_meta(db: AsyncSession) -> int:
    """Remove long-expired wrap rows (objects already deleted)."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        delete(Wrap).where(
            Wrap.status.in_([WrapStatus.expired, WrapStatus.consumed]),
            Wrap.expires_at < now,
        )
    )
    await db.commit()
    return result.rowcount or 0


async def mark_consumed(db: AsyncSession, wrap_id: str) -> Wrap | None:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        update(Wrap)
        .where(Wrap.id == wrap_id, Wrap.status == WrapStatus.pending, Wrap.expires_at > now)
        .values(status=WrapStatus.consumed, consumed_at=now)
        .returning(Wrap)
    )
    row = result.scalar_one_or_none()
    await db.commit()
    return row


async def purge_all_wraps(db: AsyncSession) -> dict[str, int]:
    """Force-delete all wrap DB rows and all objects under wraps/ in MinIO."""
    count_result = await db.execute(select(Wrap.id))
    db_count = len(list(count_result.scalars().all()))
    await db.execute(delete(Wrap))
    await db.commit()
    objects_deleted = await storage.delete_prefix("wraps/")
    return {"wraps_deleted": db_count, "objects_deleted": objects_deleted}
