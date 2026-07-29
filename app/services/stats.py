from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditEvent, Wrap, WrapStatus
from app.services.storage import storage


def format_bytes(n: int) -> str:
    n = int(n or 0)
    if n < 1024:
        return f"{n} B"
    kb = n / 1024
    if kb < 1024:
        return f"{kb:.1f} KB" if kb < 10 else f"{round(kb)} KB"
    mb = kb / 1024
    if mb < 1024:
        return f"{mb:.2f} MB" if mb < 10 else f"{mb:.1f} MB"
    gb = mb / 1024
    return f"{gb:.2f} GB"


async def collect_stats(db: AsyncSession) -> dict[str, Any]:
    # Wrap aggregates by status
    wrap_rows = (
        await db.execute(
            select(
                Wrap.status,
                func.count(Wrap.id),
                func.coalesce(func.sum(Wrap.size_bytes), 0),
                func.coalesce(func.sum(Wrap.item_count), 0),
            ).group_by(Wrap.status)
        )
    ).all()

    by_status: dict[str, dict[str, int]] = {
        "pending": {"count": 0, "size_bytes": 0, "items": 0},
        "consumed": {"count": 0, "size_bytes": 0, "items": 0},
        "expired": {"count": 0, "size_bytes": 0, "items": 0},
    }
    for status, count, size_bytes, items in wrap_rows:
        key = status.value if hasattr(status, "value") else str(status)
        by_status[key] = {
            "count": int(count or 0),
            "size_bytes": int(size_bytes or 0),
            "items": int(items or 0),
        }

    totals = await db.execute(
        select(
            func.count(Wrap.id),
            func.coalesce(func.sum(Wrap.size_bytes), 0),
            func.coalesce(func.sum(Wrap.item_count), 0),
            func.coalesce(
                func.sum(case((Wrap.has_password.is_(True), 1), else_=0)),
                0,
            ),
        )
    )
    total_wraps, total_size, total_items, with_password = totals.one()

    # Last 24h / 7d creates
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)

    created_24h = int(
        (
            await db.execute(
                select(func.count()).select_from(Wrap).where(Wrap.created_at >= day_ago)
            )
        ).scalar_one()
        or 0
    )
    created_7d = int(
        (
            await db.execute(
                select(func.count()).select_from(Wrap).where(Wrap.created_at >= week_ago)
            )
        ).scalar_one()
        or 0
    )
    consumed_24h = int(
        (
            await db.execute(
                select(func.count())
                .select_from(Wrap)
                .where(
                    Wrap.status == WrapStatus.consumed,
                    Wrap.consumed_at.is_not(None),
                    Wrap.consumed_at >= day_ago,
                )
            )
        ).scalar_one()
        or 0
    )

    # Audit counters (all-time successes / failures)
    audit_rows = (
        await db.execute(
            select(
                AuditEvent.event_type,
                AuditEvent.success,
                func.count(AuditEvent.id),
            ).group_by(AuditEvent.event_type, AuditEvent.success)
        )
    ).all()
    audit: dict[str, dict[str, int]] = {}
    for event_type, success, count in audit_rows:
        bucket = audit.setdefault(event_type, {"ok": 0, "fail": 0})
        if success:
            bucket["ok"] += int(count or 0)
        else:
            bucket["fail"] += int(count or 0)

    reason_col = AuditEvent.details.op("->>")("reason")

    password_burns = int(
        (
            await db.execute(
                select(func.count())
                .select_from(AuditEvent)
                .where(
                    AuditEvent.event_type == "wrap.unwrap",
                    AuditEvent.success.is_(False),
                    reason_col == "password_attempts_exceeded",
                )
            )
        ).scalar_one()
        or 0
    )

    async def unwrap_fail_reasons(since: datetime | None = None) -> list[dict[str, Any]]:
        filters = [
            AuditEvent.event_type == "wrap.unwrap",
            AuditEvent.success.is_(False),
        ]
        if since is not None:
            filters.append(AuditEvent.created_at >= since)
        # One expression for SELECT + GROUP BY (PG rejects duplicate binds as unequal)
        reason_key = func.coalesce(reason_col, "unknown")
        rows = (
            await db.execute(
                select(
                    reason_key,
                    func.count(AuditEvent.id),
                )
                .where(*filters)
                .group_by(reason_key)
                .order_by(func.count(AuditEvent.id).desc())
            )
        ).all()
        return [
            {"reason": str(reason or "unknown"), "count": int(count or 0)}
            for reason, count in rows
        ]

    unwrap_fail_reasons_all = await unwrap_fail_reasons()
    unwrap_fail_reasons_24h = await unwrap_fail_reasons(day_ago)

    # MinIO live objects under wraps/
    try:
        minio = await storage.prefix_stats("wraps/")
        minio_error = None
    except Exception as exc:  # noqa: BLE001 — surface soft error in UI
        minio = {"objects": 0, "bytes": 0}
        minio_error = str(exc)[:200]

    pending = by_status["pending"]
    consumed = by_status["consumed"]
    expired = by_status["expired"]
    audit_unwraps_ok = audit.get("wrap.unwrap", {}).get("ok", 0)

    return {
        "wraps_total": int(total_wraps or 0),
        "wraps_pending": pending["count"],
        "wraps_consumed": consumed["count"],
        "wraps_expired": expired["count"],
        "wraps_with_password": int(with_password or 0),
        "items_total": int(total_items or 0),
        "items_pending": pending["items"],
        "items_consumed": consumed["items"],
        "items_expired": expired["items"],
        "size_total_bytes": int(total_size or 0),
        "size_pending_bytes": pending["size_bytes"],
        "size_consumed_bytes": consumed["size_bytes"],
        "size_expired_bytes": expired["size_bytes"],
        "size_total_human": format_bytes(int(total_size or 0)),
        "size_pending_human": format_bytes(pending["size_bytes"]),
        "size_consumed_human": format_bytes(consumed["size_bytes"]),
        "size_expired_human": format_bytes(expired["size_bytes"]),
        "created_24h": created_24h,
        "created_7d": created_7d,
        "consumed_24h": consumed_24h,
        "audit_creates_ok": audit.get("wrap.create", {}).get("ok", 0),
        "audit_creates_fail": audit.get("wrap.create", {}).get("fail", 0),
        "audit_unwraps_ok": audit_unwraps_ok,
        "audit_unwraps_fail": audit.get("wrap.unwrap", {}).get("fail", 0),
        "unwraps_success": audit_unwraps_ok,
        "password_burns": password_burns,
        "unwrap_fail_reasons": unwrap_fail_reasons_all,
        "unwrap_fail_reasons_24h": unwrap_fail_reasons_24h,
        "minio_objects": int(minio.get("objects") or 0),
        "minio_bytes": int(minio.get("bytes") or 0),
        "minio_human": format_bytes(int(minio.get("bytes") or 0)),
        "minio_error": minio_error,
        "generated_at": now,
    }
