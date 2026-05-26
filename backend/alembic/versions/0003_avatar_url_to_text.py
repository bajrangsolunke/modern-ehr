"""widen avatar_url to text

Revision ID: 0003_avatar_url_text
Revises: 0002_patient_alerts
Create Date: 2026-05-26
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_avatar_url_text"
down_revision: Union[str, None] = "0002_patient_alerts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "patients",
        "avatar_url",
        existing_type=sa.String(length=512),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "patients",
        "avatar_url",
        existing_type=sa.Text(),
        type_=sa.String(length=512),
        existing_nullable=True,
    )
