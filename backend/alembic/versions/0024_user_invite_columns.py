"""add invite + setup columns to users so admins can invite via email

Revision ID: 0024_user_invite_columns
Revises: 0023_telehealth
Create Date: 2026-05-29

Mirrors the patient invite flow on the users (staff) table. The
admin creates a user record without a password; the user clicks the
invite link, sets a password via /auth/setup, and `setup_completed_at`
is timestamped."""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024_user_invite_columns"
down_revision: Union[str, None] = "0023_telehealth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_reset_token", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "password_reset_expires",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column("setup_completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_users_password_reset_token",
        "users",
        ["password_reset_token"],
        unique=True,
    )
    # Allow invited users to exist without a password until they set
    # one via the /auth/setup flow.
    op.alter_column("users", "hashed_password", nullable=True)


def downgrade() -> None:
    op.alter_column("users", "hashed_password", nullable=False)
    op.drop_index("ix_users_password_reset_token", table_name="users")
    op.drop_column("users", "setup_completed_at")
    op.drop_column("users", "password_reset_expires")
    op.drop_column("users", "password_reset_token")
