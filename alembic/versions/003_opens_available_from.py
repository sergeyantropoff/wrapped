"""max_opens / available_from for wraps; max_opens_limit in settings

Revision ID: 003_opens_available_from
Revises: 002_password_attempts
Create Date: 2026-07-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_opens_available_from"
down_revision: Union[str, None] = "002_password_attempts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column(
            "max_opens_limit",
            sa.Integer(),
            nullable=False,
            server_default="3",
        ),
    )
    op.add_column(
        "wraps",
        sa.Column(
            "max_opens",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    op.add_column(
        "wraps",
        sa.Column(
            "opens_used",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "wraps",
        sa.Column("available_from", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("wraps", "available_from")
    op.drop_column("wraps", "opens_used")
    op.drop_column("wraps", "max_opens")
    op.drop_column("app_settings", "max_opens_limit")
