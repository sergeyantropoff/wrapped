from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PublicSettingsOut(BaseModel):
    max_upload_bytes: int
    default_ttl_seconds: int
    max_ttl_seconds: int
    mime_allowlist: list[str]
    captcha_provider: str
    turnstile_site_key: str
    hcaptcha_site_key: str
    password_mode: str
    password_mode_description: dict[str, str]


class WrapCreateRequest(BaseModel):
    ciphertext_b64: str = Field(..., min_length=1)
    ttl_seconds: int = Field(..., gt=0)
    content_types: list[str] = Field(default_factory=list)
    item_count: int = Field(default=1, ge=1, le=100)
    has_password: bool = False
    password: str | None = None
    captcha_token: str | None = None


class WrapCreateResponse(BaseModel):
    wrap_id: str
    expires_at: datetime
    password_mode: str
    share_path: str


class UnwrapRequest(BaseModel):
    password: str | None = None
    captcha_token: str | None = None


class UnwrapResponse(BaseModel):
    ciphertext_b64: str
    content_types: list[str]
    item_count: int
    has_password: bool
    password_mode: str
    size_bytes: int


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminSettingsUpdate(BaseModel):
    max_upload_bytes: int | None = None
    default_ttl_seconds: int | None = None
    max_ttl_seconds: int | None = None
    mime_allowlist: list[str] | None = None
    rate_limit_create_per_minute: int | None = None
    rate_limit_unwrap_per_minute: int | None = None
    rate_limit_admin_login_per_minute: int | None = None
    captcha_provider: str | None = None
    turnstile_site_key: str | None = None
    hcaptcha_site_key: str | None = None
    password_mode: str | None = None
    audit_retention_days: int | None = None


class AuditEventOut(BaseModel):
    id: str
    created_at: datetime
    event_type: str
    wrap_id: str | None
    success: bool
    ip: str | None
    user_agent: str | None
    accept_language: str | None
    forwarded_for: str | None
    details: dict[str, Any]
