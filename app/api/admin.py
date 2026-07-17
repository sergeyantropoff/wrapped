from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.models import CaptchaProvider, DEFAULT_MIME_ALLOWLIST, PasswordMode
from app.schemas import AdminSettingsUpdate
from app.services.admin_auth import (
    AdminAuth,
    AdminWebAuth,
    clear_admin_cookie,
    get_admin_user,
    set_admin_cookie,
)
from app.services.audit import (
    count_audit,
    list_audit,
    list_audit_event_types,
    purge_old_audit,
    write_audit,
)
from app.services.rate_limit import rate_limiter
from app.services.settings_service import PASSWORD_MODE_HELP, get_or_create_settings
from app.services.wraps import cleanup_expired_meta, expire_due_wraps, purge_all_wraps, request_meta

router = APIRouter(prefix="/admin", include_in_schema=False)
api_router = APIRouter(prefix="/admin/api", tags=["Admin"])
templates = Jinja2Templates(directory="app/templates")


@router.get("")
async def admin_root(request: Request):
    if get_admin_user(request):
        return RedirectResponse("/admin/settings", status_code=302)
    return RedirectResponse("/admin/login", status_code=302)


@router.get("/login")
async def login_page(request: Request):
    if get_admin_user(request):
        return RedirectResponse("/admin/settings", status_code=302)
    return templates.TemplateResponse(
        request,
        "admin_login.html",
        {"title": "Admin login"},
    )


@router.post("/login")
async def login_submit(request: Request, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    app_settings = await get_or_create_settings(db)
    meta = request_meta(request)
    ip = meta["ip"] or "unknown"

    if not rate_limiter.allow(
        f"admin_login:{ip}", app_settings.rate_limit_admin_login_per_minute
    ):
        await write_audit(
            db,
            event_type="admin.login",
            success=False,
            **meta,
            details={"reason": "rate_limited"},
        )
        return templates.TemplateResponse(
            request,
            "admin_login.html",
            {"title": "Admin login", "error": "Too many attempts. Try later.", "error_key": "admin.login.error.rate"},
            status_code=429,
        )

    form = await request.form()
    username = str(form.get("username") or "")
    password = str(form.get("password") or "")

    if username == settings.admin_username and password == settings.admin_password:
        purged_audit = await purge_old_audit(db, app_settings.audit_retention_days)
        expired = await expire_due_wraps(db)
        cleaned = await cleanup_expired_meta(db)
        await write_audit(
            db,
            event_type="admin.login",
            success=True,
            **meta,
            details={
                "purged_audit": purged_audit,
                "expired_wraps": expired,
                "cleaned_meta": cleaned,
            },
        )
        response = RedirectResponse("/admin/settings", status_code=302)
        set_admin_cookie(response, username)
        return response

    await write_audit(
        db,
        event_type="admin.login",
        success=False,
        **meta,
        details={"reason": "bad_credentials"},
    )
    return templates.TemplateResponse(
        request,
        "admin_login.html",
        {"title": "Admin login", "error": "Invalid credentials", "error_key": "admin.login.error.bad"},
        status_code=401,
    )


@router.post("/logout")
async def logout(request: Request, db: AsyncSession = Depends(get_db)):
    meta = request_meta(request)
    if get_admin_user(request):
        await write_audit(db, event_type="admin.logout", success=True, **meta)
    response = RedirectResponse("/admin/login", status_code=302)
    clear_admin_cookie(response)
    return response


@router.get("/settings")
async def settings_page(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _admin: AdminWebAuth = ...,
):
    row = await get_or_create_settings(db)
    env = get_settings()
    return templates.TemplateResponse(
        request,
        "admin_settings.html",
        {
            "title": "Settings",
            "settings": row,
            "password_mode_help": PASSWORD_MODE_HELP,
            "mime_examples": DEFAULT_MIME_ALLOWLIST,
            "turnstile_secret_set": bool(env.turnstile_secret_key),
            "hcaptcha_secret_set": bool(env.hcaptcha_secret_key),
            "captcha_providers": list(CaptchaProvider),
            "password_modes": list(PasswordMode),
            "active": "settings",
        },
    )


@router.post("/settings")
async def settings_save(
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: AdminWebAuth = ...,
):
    row = await get_or_create_settings(db)
    form = await request.form()
    meta = request_meta(request)

    def as_int(name: str, default: int) -> int:
        raw = form.get(name)
        try:
            return int(str(raw))
        except Exception:
            return default

    old = {
        "max_upload_bytes": row.max_upload_bytes,
        "default_ttl_seconds": row.default_ttl_seconds,
        "max_ttl_seconds": row.max_ttl_seconds,
        "captcha_provider": row.captcha_provider.value,
        "password_mode": row.password_mode.value,
    }

    row.max_upload_bytes = max(1, as_int("max_upload_mb", max(1, row.max_upload_bytes // 1048576))) * 1048576
    row.default_ttl_seconds = max(1, as_int("default_ttl_hours", max(1, row.default_ttl_seconds // 3600))) * 3600
    row.max_ttl_seconds = max(1, as_int("max_ttl_hours", max(1, row.max_ttl_seconds // 3600))) * 3600
    if row.default_ttl_seconds > row.max_ttl_seconds:
        row.default_ttl_seconds = row.max_ttl_seconds
    row.rate_limit_create_per_minute = as_int(
        "rate_limit_create_per_minute", row.rate_limit_create_per_minute
    )
    row.rate_limit_unwrap_per_minute = as_int(
        "rate_limit_unwrap_per_minute", row.rate_limit_unwrap_per_minute
    )
    row.rate_limit_admin_login_per_minute = as_int(
        "rate_limit_admin_login_per_minute", row.rate_limit_admin_login_per_minute
    )
    row.audit_retention_days = as_int("audit_retention_days", row.audit_retention_days)
    row.turnstile_site_key = str(form.get("turnstile_site_key") or "").strip()
    row.hcaptcha_site_key = str(form.get("hcaptcha_site_key") or "").strip()

    mime_raw = str(form.get("mime_allowlist") or "")
    row.mime_allowlist = [line.strip() for line in mime_raw.splitlines() if line.strip()]

    captcha = str(form.get("captcha_provider") or "off")
    try:
        row.captcha_provider = CaptchaProvider(captcha)
    except ValueError:
        pass

    pwd_mode = str(form.get("password_mode") or "client_only")
    try:
        row.password_mode = PasswordMode(pwd_mode)
    except ValueError:
        pass

    await db.commit()
    await write_audit(
        db,
        event_type="admin.settings_update",
        success=True,
        **meta,
        details={"admin": admin, "old": old},
    )
    return RedirectResponse("/admin/settings?saved=1", status_code=302)


@router.post("/purge")
async def purge_all(
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: AdminWebAuth = ...,
):
    meta = request_meta(request)
    form = await request.form()
    confirm = str(form.get("confirm") or "").strip().upper()
    if confirm != "PURGE":
        await write_audit(
            db,
            event_type="admin.purge",
            success=False,
            **meta,
            details={"admin": admin, "reason": "confirm_mismatch"},
        )
        return RedirectResponse("/admin/danger?purge=confirm", status_code=302)

    try:
        stats = await purge_all_wraps(db)
        await write_audit(
            db,
            event_type="admin.purge",
            success=True,
            **meta,
            details={"admin": admin, **stats},
        )
        return RedirectResponse(
            f"/admin/danger?purged=1&wraps={stats['wraps_deleted']}&objects={stats['objects_deleted']}",
            status_code=302,
        )
    except Exception as exc:
        await write_audit(
            db,
            event_type="admin.purge",
            success=False,
            **meta,
            details={"admin": admin, "reason": "error", "error": str(exc)[:200]},
        )
        return RedirectResponse("/admin/danger?purge=error", status_code=302)


@router.get("/danger")
async def danger_page(
    request: Request,
    _admin: AdminWebAuth = ...,
):
    return templates.TemplateResponse(
        request,
        "admin_danger.html",
        {
            "title": "Danger zone",
            "active": "danger",
        },
    )


@router.get("/audit")
async def audit_page(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _admin: AdminWebAuth = ...,
):
    event_type = request.query_params.get("event_type") or None
    wrap_id = request.query_params.get("wrap_id") or None
    if event_type == "":
        event_type = None
    per_page = 50
    try:
        page = max(1, int(request.query_params.get("page") or "1"))
    except ValueError:
        page = 1
    total = await count_audit(db, event_type=event_type, wrap_id=wrap_id or None)
    pages = max(1, (total + per_page - 1) // per_page) if total else 1
    if page > pages:
        page = pages
    offset = (page - 1) * per_page
    events = await list_audit(
        db,
        limit=per_page,
        offset=offset,
        event_type=event_type,
        wrap_id=wrap_id or None,
    )
    event_types = await list_audit_event_types(db)
    from_idx = offset + 1 if total else 0
    to_idx = offset + len(events)
    return templates.TemplateResponse(
        request,
        "admin_audit.html",
        {
            "title": "Audit",
            "events": events,
            "event_type": event_type or "",
            "wrap_id": wrap_id or "",
            "event_types": event_types,
            "active": "audit",
            "page": page,
            "pages": pages,
            "per_page": per_page,
            "total": total,
            "from_idx": from_idx,
            "to_idx": to_idx,
            "has_prev": page > 1,
            "has_next": page < pages,
        },
    )


@api_router.get("/settings", summary="Get admin settings")
async def admin_settings_api(
    db: AsyncSession = Depends(get_db),
    _admin: AdminAuth = ...,
):
    row = await get_or_create_settings(db)
    return JSONResponse(
        {
            "max_upload_bytes": row.max_upload_bytes,
            "default_ttl_seconds": row.default_ttl_seconds,
            "max_ttl_seconds": row.max_ttl_seconds,
            "mime_allowlist": row.mime_allowlist,
            "captcha_provider": row.captcha_provider.value,
            "password_mode": row.password_mode.value,
            "audit_retention_days": row.audit_retention_days,
            "rate_limit_create_per_minute": row.rate_limit_create_per_minute,
            "rate_limit_unwrap_per_minute": row.rate_limit_unwrap_per_minute,
            "rate_limit_admin_login_per_minute": row.rate_limit_admin_login_per_minute,
        }
    )


@api_router.put("/settings", summary="Update admin settings")
async def admin_settings_put(
    body: AdminSettingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: AdminAuth = ...,
):
    row = await get_or_create_settings(db)
    data = body.model_dump(exclude_unset=True)
    if "captcha_provider" in data and data["captcha_provider"] is not None:
        row.captcha_provider = CaptchaProvider(data.pop("captcha_provider"))
    if "password_mode" in data and data["password_mode"] is not None:
        row.password_mode = PasswordMode(data.pop("password_mode"))
    for key, value in data.items():
        if value is not None and hasattr(row, key):
            setattr(row, key, value)
    await db.commit()
    meta = request_meta(request)
    await write_audit(
        db,
        event_type="admin.settings_update",
        success=True,
        **meta,
        details={"admin": admin, "via": "api"},
    )
    return {"ok": True}


@api_router.post("/purge", summary="Force-delete all wraps and MinIO objects")
async def admin_purge_api(
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: AdminAuth = ...,
    confirm: str = "PURGE",
):
    meta = request_meta(request)
    if confirm.strip().upper() != "PURGE":
        raise HTTPException(status_code=400, detail="confirm must be PURGE")
    stats = await purge_all_wraps(db)
    await write_audit(
        db,
        event_type="admin.purge",
        success=True,
        **meta,
        details={"admin": admin, "via": "api", **stats},
    )
    return {"ok": True, **stats}


@api_router.get("/audit", summary="List audit events")
async def admin_audit_api(
    db: AsyncSession = Depends(get_db),
    _admin: AdminAuth = ...,
    event_type: str | None = None,
    wrap_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    events = await list_audit(
        db,
        limit=min(limit, 500),
        offset=max(0, offset),
        event_type=event_type,
        wrap_id=wrap_id,
    )
    return [
        {
            "id": str(e.id),
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "event_type": e.event_type,
            "wrap_id": e.wrap_id,
            "success": e.success,
            "ip": e.ip,
            "user_agent": e.user_agent,
            "details": e.details,
        }
        for e in events
    ]
