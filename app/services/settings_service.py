from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    DEFAULT_MIME_ALLOWLIST,
    AppSettings,
    CaptchaProvider,
    PasswordMode,
)


PASSWORD_MODE_HELP = {
    "client_only": (
        "Password is verified only in the browser after ciphertext download. "
        "Maximum zero-knowledge: the server never checks the password. "
        "Best when you trust link secrecy and want strongest ZK."
    ),
    "server_gate": (
        "Server stores an Argon2id hash and releases ciphertext only after a correct password. "
        "Slightly weaker ZK metadata (server knows password success/fail) but stops offline "
        "bruteforce if someone steals the share link without the password."
    ),
}


async def get_or_create_settings(db: AsyncSession) -> AppSettings:
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    row = result.scalar_one_or_none()
    if row:
        return row
    row = AppSettings(
        id=1,
        mime_allowlist=list(DEFAULT_MIME_ALLOWLIST),
        captcha_provider=CaptchaProvider.off,
        password_mode=PasswordMode.client_only,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


def mime_allowed(allowlist: list[str], content_type: str) -> bool:
    ct = (content_type or "").split(";")[0].strip().lower()
    if not ct:
        return False
    for pattern in allowlist:
        p = pattern.strip().lower()
        if not p:
            continue
        if p.endswith("/*"):
            if ct.startswith(p[:-1]):
                return True
        elif ct == p:
            return True
    return False


def public_settings_payload(row: AppSettings) -> dict:
    return {
        "max_upload_bytes": row.max_upload_bytes,
        "default_ttl_seconds": row.default_ttl_seconds,
        "max_ttl_seconds": row.max_ttl_seconds,
        "mime_allowlist": list(row.mime_allowlist or []),
        "captcha_provider": row.captcha_provider.value,
        "turnstile_site_key": row.turnstile_site_key or "",
        "hcaptcha_site_key": row.hcaptcha_site_key or "",
        "password_mode": row.password_mode.value,
        "password_mode_description": PASSWORD_MODE_HELP,
    }
