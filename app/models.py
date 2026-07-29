from __future__ import annotations

import enum
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class WrapStatus(str, enum.Enum):
    pending = "pending"
    consumed = "consumed"
    expired = "expired"


class PasswordMode(str, enum.Enum):
    client_only = "client_only"
    server_gate = "server_gate"


class CaptchaProvider(str, enum.Enum):
    off = "off"
    turnstile = "turnstile"
    hcaptcha = "hcaptcha"


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    max_upload_bytes: Mapped[int] = mapped_column(BigInteger, default=25 * 1024 * 1024)
    default_ttl_seconds: Mapped[int] = mapped_column(Integer, default=24 * 3600)
    max_ttl_seconds: Mapped[int] = mapped_column(Integer, default=7 * 24 * 3600)
    mime_allowlist: Mapped[list[Any]] = mapped_column(
        JSONB,
        default=list,
    )
    rate_limit_create_per_minute: Mapped[int] = mapped_column(Integer, default=10)
    rate_limit_unwrap_per_minute: Mapped[int] = mapped_column(Integer, default=30)
    rate_limit_admin_login_per_minute: Mapped[int] = mapped_column(Integer, default=5)
    captcha_provider: Mapped[CaptchaProvider] = mapped_column(
        Enum(CaptchaProvider, name="captcha_provider"),
        default=CaptchaProvider.off,
    )
    turnstile_site_key: Mapped[str] = mapped_column(String(256), default="")
    hcaptcha_site_key: Mapped[str] = mapped_column(String(256), default="")
    password_mode: Mapped[PasswordMode] = mapped_column(
        Enum(PasswordMode, name="password_mode"),
        default=PasswordMode.client_only,
    )
    # Wrong unwrap passwords allowed before the wrap is burned (default 3).
    password_max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    audit_retention_days: Mapped[int] = mapped_column(Integer, default=90)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Wrap(Base):
    __tablename__ = "wraps"
    __table_args__ = (Index("ix_wraps_expires_at", "expires_at"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    status: Mapped[WrapStatus] = mapped_column(
        Enum(WrapStatus, name="wrap_status"),
        default=WrapStatus.pending,
        index=True,
    )
    object_key: Mapped[str] = mapped_column(String(512), unique=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    content_types: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    item_count: Mapped[int] = mapped_column(Integer, default=1)
    has_password: Mapped[bool] = mapped_column(Boolean, default=False)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_fail_count: Mapped[int] = mapped_column(Integer, default=0)
    password_mode: Mapped[PasswordMode] = mapped_column(
        Enum(PasswordMode, name="password_mode", create_constraint=False),
        default=PasswordMode.client_only,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    creator_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    creator_ua: Mapped[str | None] = mapped_column(String(512), nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        Index("ix_audit_created_at", "created_at"),
        Index("ix_audit_event_type", "event_type"),
    )

    id: Mapped[Any] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    event_type: Mapped[str] = mapped_column(String(64))
    wrap_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    accept_language: Mapped[str | None] = mapped_column(String(128), nullable=True)
    forwarded_for: Mapped[str | None] = mapped_column(String(256), nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


DEFAULT_MIME_ALLOWLIST = [
    "image/*",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "text/*",
    "text/plain",
    "text/markdown",
    "text/csv",
    "text/html",
    "text/css",
    "text/javascript",
    "application/json",
    "application/xml",
    "application/yaml",
    "application/x-yaml",
    "text/yaml",
    "application/octet-stream",
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "application/gzip",
    "application/x-gzip",
    "application/x-tar",
    "application/x-7z-compressed",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/msword",
    "application/vnd.ms-excel",
    "audio/*",
    "video/*",
]
