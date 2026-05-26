"""patient alerts table

Revision ID: 0002_patient_alerts
Revises: 0001_initial
Create Date: 2026-05-26
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_patient_alerts"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reference the type — let SQLAlchemy create it during create_table.
    severity_col_type = sa.Enum(
        "critical",
        "warning",
        "info",
        name="alert_severity",
    )

    op.create_table(
        "patient_alerts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "patient_id",
            sa.Uuid(),
            sa.ForeignKey("patients.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "severity",
            severity_col_type,
            nullable=False,
            server_default="info",
        ),
        sa.Column("label", sa.String(length=128), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column(
            "resolved",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_by_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("patient_alerts")
    sa.Enum(name="alert_severity").drop(op.get_bind(), checkfirst=True)
