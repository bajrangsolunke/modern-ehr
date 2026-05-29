"""appointment modality (in_person | virtual)

Revision ID: 0025_appointment_modality
Revises: 0024_user_invite_columns
Create Date: 2026-05-29

Adds a `modality` column to `appointments`, separate from `type`
(the medical kind of visit). `virtual` is the flag that gates
telehealth/video — only virtual appointments expose the
"Start telehealth visit" / "Join video visit" CTAs.

Existing rows get backfilled to `in_person` via the server_default.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM

revision: str = "0025_appointment_modality"
down_revision: Union[str, None] = "0024_user_invite_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MODALITY = PG_ENUM(
    "in_person",
    "virtual",
    name="appointment_modality",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_modality') THEN
                CREATE TYPE appointment_modality AS ENUM ('in_person', 'virtual');
            END IF;
        END$$;
        """
    )
    op.add_column(
        "appointments",
        sa.Column(
            "modality",
            MODALITY,
            nullable=False,
            server_default="in_person",
        ),
    )
    op.create_index(
        "ix_appointments_modality",
        "appointments",
        ["modality"],
    )


def downgrade() -> None:
    op.drop_index("ix_appointments_modality", table_name="appointments")
    op.drop_column("appointments", "modality")
    op.execute("DROP TYPE IF EXISTS appointment_modality;")
