"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-07-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    captcha_provider = postgresql.ENUM(
        "off", "turnstile", "hcaptcha", name="captcha_provider", create_type=False
    )
    password_mode = postgresql.ENUM(
        "client_only", "server_gate", name="password_mode", create_type=False
    )
    wrap_status = postgresql.ENUM(
        "pending", "consumed", "expired", name="wrap_status", create_type=False
    )

    captcha_provider.create(op.get_bind(), checkfirst=True)
    password_mode.create(op.get_bind(), checkfirst=True)
    wrap_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("max_upload_bytes", sa.BigInteger(), nullable=False),
        sa.Column("default_ttl_seconds", sa.Integer(), nullable=False),
        sa.Column("max_ttl_seconds", sa.Integer(), nullable=False),
        sa.Column("mime_allowlist", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("rate_limit_create_per_minute", sa.Integer(), nullable=False),
        sa.Column("rate_limit_unwrap_per_minute", sa.Integer(), nullable=False),
        sa.Column("rate_limit_admin_login_per_minute", sa.Integer(), nullable=False),
        sa.Column("captcha_provider", captcha_provider, nullable=False),
        sa.Column("turnstile_site_key", sa.String(length=256), nullable=False),
        sa.Column("hcaptcha_site_key", sa.String(length=256), nullable=False),
        sa.Column("password_mode", password_mode, nullable=False),
        sa.Column("audit_retention_days", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "wraps",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("status", wrap_status, nullable=False),
        sa.Column("object_key", sa.String(length=512), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("content_types", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("item_count", sa.Integer(), nullable=False),
        sa.Column("has_password", sa.Boolean(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("password_mode", password_mode, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("creator_ip", sa.String(length=64), nullable=True),
        sa.Column("creator_ua", sa.String(length=512), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("object_key"),
    )
    op.create_index("ix_wraps_expires_at", "wraps", ["expires_at"])
    op.create_index("ix_wraps_status", "wraps", ["status"])
    op.create_index("ix_wraps_created_at", "wraps", ["created_at"])

    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("wrap_id", sa.String(length=32), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("accept_language", sa.String(length=128), nullable=True),
        sa.Column("forwarded_for", sa.String(length=256), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_created_at", "audit_events", ["created_at"])
    op.create_index("ix_audit_event_type", "audit_events", ["event_type"])
    op.create_index("ix_audit_events_wrap_id", "audit_events", ["wrap_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_events_wrap_id", table_name="audit_events")
    op.drop_index("ix_audit_event_type", table_name="audit_events")
    op.drop_index("ix_audit_created_at", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_index("ix_wraps_created_at", table_name="wraps")
    op.drop_index("ix_wraps_status", table_name="wraps")
    op.drop_index("ix_wraps_expires_at", table_name="wraps")
    op.drop_table("wraps")
    op.drop_table("app_settings")
    op.execute("DROP TYPE IF EXISTS wrap_status")
    op.execute("DROP TYPE IF EXISTS password_mode")
    op.execute("DROP TYPE IF EXISTS captcha_provider")
