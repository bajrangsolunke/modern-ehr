"""add alert source enum + column

Revision ID: 0016_alert_source
Revises: 0015_task_type
Create Date: 2026-05-28

Adds the `source` column to `patient_alerts` so we can distinguish
clinician-entered alerts from AI-generated ones (intake red flags,
future lab anomalies, etc.) and from deterministic-rule alerts.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016_alert_source"
down_revision: Union[str, None] = "0015_task_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ALERT_SOURCE = sa.Enum("manual", "ai", "system", name="alert_source")


def upgrade() -> None:
    ALERT_SOURCE.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "patient_alerts",
        sa.Column(
            "source",
            ALERT_SOURCE,
            nullable=False,
            server_default="manual",
        ),
    )
    op.create_index(
        "ix_patient_alerts_source", "patient_alerts", ["source"]
    )


def downgrade() -> None:
    op.drop_index("ix_patient_alerts_source", table_name="patient_alerts")
    op.drop_column("patient_alerts", "source")
    ALERT_SOURCE.drop(op.get_bind(), checkfirst=True)
