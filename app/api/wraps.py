from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Wrap, WrapStatus
from app.schemas import (
    PublicSettingsOut,
    UnwrapRequest,
    UnwrapResponse,
    WrapCreateRequest,
    WrapCreateResponse,
)
from app.services.audit import write_audit
from app.services.captcha import verify_captcha
from app.services.password_hash import hash_password, verify_password
from app.services.rate_limit import rate_limiter
from app.services.settings_service import get_or_create_settings, mime_allowed, public_settings_payload
from app.services.storage import storage
from app.services.wraps import delete_wrap_object, expire_due_wraps, new_wrap_id, request_meta

router = APIRouter(prefix="/api/v1")


@router.get(
    "/settings",
    response_model=PublicSettingsOut,
    tags=["Public"],
    summary="Public client settings",
)
async def public_settings(db: AsyncSession = Depends(get_db)) -> PublicSettingsOut:
    row = await get_or_create_settings(db)
    return PublicSettingsOut(**public_settings_payload(row))


@router.post(
    "/wraps",
    response_model=WrapCreateResponse,
    tags=["Wraps"],
    summary="Create encrypted wrap",
)
async def create_wrap(
    body: WrapCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> WrapCreateResponse:
    meta = request_meta(request)
    settings = await get_or_create_settings(db)
    ip = meta["ip"] or "unknown"

    if not rate_limiter.allow(
        f"create:{ip}", settings.rate_limit_create_per_minute
    ):
        await write_audit(
            db,
            event_type="wrap.create",
            success=False,
            **meta,
            details={"reason": "rate_limited"},
        )
        raise HTTPException(status_code=429, detail="rate_limited")

    ok, reason = await verify_captcha(
        settings.captcha_provider,
        body.captcha_token,
        ip,
        turnstile_site_configured=bool(settings.turnstile_site_key),
        hcaptcha_site_configured=bool(settings.hcaptcha_site_key),
    )
    if not ok:
        await write_audit(
            db,
            event_type="wrap.create",
            success=False,
            **meta,
            details={"reason": f"captcha_{reason}"},
        )
        raise HTTPException(status_code=400, detail="captcha_failed")

    if body.ttl_seconds > settings.max_ttl_seconds:
        raise HTTPException(status_code=400, detail="ttl_too_large")

    try:
        ciphertext = base64.b64decode(body.ciphertext_b64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid_ciphertext") from exc

    if len(ciphertext) > settings.max_upload_bytes:
        await write_audit(
            db,
            event_type="wrap.create",
            success=False,
            **meta,
            details={"reason": "too_large", "size": len(ciphertext)},
        )
        raise HTTPException(status_code=413, detail="too_large")

    allowlist = list(settings.mime_allowlist or [])
    for ct in body.content_types:
        if not mime_allowed(allowlist, ct):
            await write_audit(
                db,
                event_type="wrap.create",
                success=False,
                **meta,
                details={"reason": "mime_denied", "content_type": ct},
            )
            raise HTTPException(status_code=400, detail="mime_not_allowed")

    # Always store Argon2 hash when a password is set so wrong guesses
    # are rejected *before* the one-time ciphertext is consumed.
    password_hash = None
    if body.has_password:
        if not body.password:
            raise HTTPException(status_code=400, detail="password_required")
        password_hash = hash_password(body.password)

    wrap_id = new_wrap_id()
    object_key = f"wraps/{wrap_id}.bin"
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=body.ttl_seconds)

    await storage.put_bytes(object_key, ciphertext)

    wrap = Wrap(
        id=wrap_id,
        status=WrapStatus.pending,
        object_key=object_key,
        size_bytes=len(ciphertext),
        content_types=body.content_types,
        item_count=body.item_count,
        has_password=body.has_password,
        password_hash=password_hash,
        password_mode=settings.password_mode,
        expires_at=expires_at,
        creator_ip=ip,
        creator_ua=(meta["user_agent"] or "")[:512] or None,
    )
    db.add(wrap)
    await db.commit()

    await write_audit(
        db,
        event_type="wrap.create",
        success=True,
        wrap_id=wrap_id,
        **meta,
        details={
            "size_bytes": len(ciphertext),
            "item_count": body.item_count,
            "content_types": body.content_types,
            "ttl_seconds": body.ttl_seconds,
            "has_password": body.has_password,
            "password_mode": settings.password_mode.value,
        },
    )

    return WrapCreateResponse(
        wrap_id=wrap_id,
        expires_at=expires_at,
        password_mode=settings.password_mode.value,
        share_path=f"/w/{wrap_id}",
    )


@router.post(
    "/wraps/{wrap_id}/unwrap",
    response_model=UnwrapResponse,
    tags=["Wraps"],
    summary="One-time unwrap",
)
async def unwrap(
    wrap_id: str,
    body: UnwrapRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UnwrapResponse:
    meta = request_meta(request)
    settings = await get_or_create_settings(db)
    ip = meta["ip"] or "unknown"

    if not rate_limiter.allow(
        f"unwrap:{ip}", settings.rate_limit_unwrap_per_minute
    ):
        await write_audit(
            db,
            event_type="wrap.unwrap",
            success=False,
            wrap_id=wrap_id,
            **meta,
            details={"reason": "rate_limited"},
        )
        raise HTTPException(status_code=429, detail="rate_limited")

    ok, reason = await verify_captcha(
        settings.captcha_provider,
        body.captcha_token,
        ip,
        turnstile_site_configured=bool(settings.turnstile_site_key),
        hcaptcha_site_configured=bool(settings.hcaptcha_site_key),
    )
    if not ok:
        await write_audit(
            db,
            event_type="wrap.unwrap",
            success=False,
            wrap_id=wrap_id,
            **meta,
            details={"reason": f"captcha_{reason}"},
        )
        raise HTTPException(status_code=400, detail="captcha_failed")

    await expire_due_wraps(db)

    from sqlalchemy import select

    result = await db.execute(select(Wrap).where(Wrap.id == wrap_id))
    wrap = result.scalar_one_or_none()

    # Uniform-ish failure for enumeration resistance
    def fail(reason: str, status: int = 410) -> None:
        raise HTTPException(status_code=status, detail=reason)

    if not wrap or wrap.status != WrapStatus.pending:
        await write_audit(
            db,
            event_type="wrap.unwrap",
            success=False,
            wrap_id=wrap_id,
            **meta,
            details={"reason": "unavailable"},
        )
        fail("unavailable")

    assert wrap is not None
    if wrap.expires_at <= datetime.now(timezone.utc):
        wrap.status = WrapStatus.expired
        await delete_wrap_object(db, wrap)
        await db.commit()
        await write_audit(
            db,
            event_type="wrap.unwrap",
            success=False,
            wrap_id=wrap_id,
            **meta,
            details={"reason": "expired"},
        )
        fail("unavailable")

    if wrap.has_password and wrap.password_hash:
        max_attempts = max(1, int(settings.password_max_attempts or 3))
        # Empty password: ask to enter it, do not burn an attempt.
        if not (body.password or "").strip():
            remaining = max(0, max_attempts - int(wrap.password_fail_count or 0))
            await write_audit(
                db,
                event_type="wrap.unwrap",
                success=False,
                wrap_id=wrap_id,
                **meta,
                details={
                    "reason": "password_required",
                    "attempts_remaining": remaining,
                    "attempts_max": max_attempts,
                },
            )
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "password_required",
                    "attempts_remaining": remaining,
                    "attempts_max": max_attempts,
                },
            )

        if not verify_password(wrap.password_hash, body.password):
            wrap.password_fail_count = int(wrap.password_fail_count or 0) + 1
            remaining = max(0, max_attempts - wrap.password_fail_count)
            now_fail = datetime.now(timezone.utc)

            if wrap.password_fail_count >= max_attempts:
                wrap.status = WrapStatus.consumed
                wrap.consumed_at = now_fail
                await delete_wrap_object(db, wrap)
                await db.commit()
                await write_audit(
                    db,
                    event_type="wrap.unwrap",
                    success=False,
                    wrap_id=wrap_id,
                    **meta,
                    details={
                        "reason": "password_attempts_exceeded",
                        "attempts": wrap.password_fail_count,
                        "attempts_max": max_attempts,
                    },
                )
                raise HTTPException(
                    status_code=403,
                    detail={
                        "code": "password_locked",
                        "attempts_remaining": 0,
                        "attempts_max": max_attempts,
                    },
                )

            await db.commit()
            await write_audit(
                db,
                event_type="wrap.unwrap",
                success=False,
                wrap_id=wrap_id,
                **meta,
                details={
                    "reason": "bad_password",
                    "attempts": wrap.password_fail_count,
                    "attempts_remaining": remaining,
                    "attempts_max": max_attempts,
                },
            )
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "bad_password",
                    "attempts_remaining": remaining,
                    "attempts_max": max_attempts,
                },
            )

    # Atomic consume
    from sqlalchemy import update

    now = datetime.now(timezone.utc)
    upd = await db.execute(
        update(Wrap)
        .where(
            Wrap.id == wrap_id,
            Wrap.status == WrapStatus.pending,
            Wrap.expires_at > now,
        )
        .values(status=WrapStatus.consumed, consumed_at=now)
        .returning(Wrap.id)
    )
    consumed = upd.scalar_one_or_none()
    await db.commit()
    if not consumed:
        await write_audit(
            db,
            event_type="wrap.unwrap",
            success=False,
            wrap_id=wrap_id,
            **meta,
            details={"reason": "unavailable"},
        )
        fail("unavailable")

    try:
        data = await storage.get_bytes(wrap.object_key)
    except Exception:
        await write_audit(
            db,
            event_type="wrap.unwrap",
            success=False,
            wrap_id=wrap_id,
            **meta,
            details={"reason": "storage_error"},
        )
        raise HTTPException(status_code=500, detail="storage_error") from None
    finally:
        await delete_wrap_object(db, wrap)

    await write_audit(
        db,
        event_type="wrap.unwrap",
        success=True,
        wrap_id=wrap_id,
        **meta,
        details={
            "size_bytes": wrap.size_bytes,
            "item_count": wrap.item_count,
            "content_types": wrap.content_types,
        },
    )

    return UnwrapResponse(
        ciphertext_b64=base64.b64encode(data).decode("ascii"),
        content_types=list(wrap.content_types or []),
        item_count=wrap.item_count,
        has_password=wrap.has_password,
        password_mode=wrap.password_mode.value,
        size_bytes=wrap.size_bytes,
    )
