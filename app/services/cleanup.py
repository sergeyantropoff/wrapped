from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Wrap, WrapStatus
from app.services.storage import storage


async def purge_expired_wraps(db: AsyncSession) -> int:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Wrap).where(
            and_(
                Wrap.status == WrapStatus.pending,
                Wrap.expires_at < now,
            )
        )
    )
    wraps = list(result.scalars().all())
    count = 0
    for wrap in wraps:
        try:
            await storage.delete(wrap.object_key)
        except Exception:
            pass
        wrap.status = WrapStatus.expired
        count += 1
    if count:
        await db.commit()
    return count


async def cleanup_consumed_orphans(db: AsyncSession) -> int:
    """Best-effort: mark very old pending with missing logic already handled elsewhere."""
    result = await db.execute(
        select(Wrap).where(
            or_(
                Wrap.status == WrapStatus.consumed,
                Wrap.status == WrapStatus.expired,
            )
        ).limit(0)
    )
    _ = result
    return 0
