"""patient condition_tag

Revision ID: 0010_patient_condition_tag
Revises: 0009_messaging
Create Date: 2026-05-27

Adds a controlled-vocabulary `condition_tag` column to patients —
drives the chip filters on the Communication module's conversation
list and is also useful for analytics roll-ups (Diabetic / Asthma /
Cancer / BP / Mental / etc.).
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_patient_condition_tag"
down_revision: Union[str, None] = "0009_messaging"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "patients",
        sa.Column("condition_tag", sa.String(length=32), nullable=True),
    )
    op.create_index(
        "ix_patients_condition_tag", "patients", ["condition_tag"]
    )


def downgrade() -> None:
    op.drop_index("ix_patients_condition_tag", table_name="patients")
    op.drop_column("patients", "condition_tag")
