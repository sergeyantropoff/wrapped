from __future__ import annotations

import httpx

from app.config import get_settings
from app.models import CaptchaProvider


async def verify_captcha(
    provider: CaptchaProvider,
    token: str | None,
    remote_ip: str | None,
    *,
    turnstile_site_configured: bool,
    hcaptcha_site_configured: bool,
) -> tuple[bool, str]:
    if provider == CaptchaProvider.off:
        return True, "off"

    if not token:
        return False, "missing_token"

    settings = get_settings()

    if provider == CaptchaProvider.turnstile:
        if not turnstile_site_configured:
            return False, "turnstile_not_configured"
        secret = settings.turnstile_secret_key
        if not secret:
            return False, "turnstile_secret_missing"
        return await _post_verify(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {"secret": secret, "response": token, "remoteip": remote_ip or ""},
        )

    if provider == CaptchaProvider.hcaptcha:
        if not hcaptcha_site_configured:
            return False, "hcaptcha_not_configured"
        secret = settings.hcaptcha_secret_key
        if not secret:
            return False, "hcaptcha_secret_missing"
        return await _post_verify(
            "https://hcaptcha.com/siteverify",
            {"secret": secret, "response": token, "remoteip": remote_ip or ""},
        )

    return False, "unknown_provider"


async def _post_verify(url: str, data: dict) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, data=data)
            payload = resp.json()
            if payload.get("success"):
                return True, "ok"
            return False, "verify_failed"
    except Exception:
        return False, "verify_error"
