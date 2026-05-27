"""widen users.avatar_url to text

Revision ID: 0006_user_avatar_text
Revises: 0005_user_availability
Create Date: 2026-05-27

Mirrors migration 0003 (which widened patients.avatar_url). The
column held data URLs from the in-app uploader, and 512 chars is far
too short for a base64-encoded JPEG (~30–80 KB after resize).
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_user_avatar_text"
down_revision: Union[str, None] = "0005_user_availability"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "avatar_url",
        existing_type=sa.String(length=512),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "avatar_url",
        existing_type=sa.Text(),
        type_=sa.String(length=512),
        existing_nullable=True,
    )
