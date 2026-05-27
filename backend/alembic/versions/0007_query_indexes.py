"""query path indexes

Revision ID: 0007_query_indexes
Revises: 0006_user_avatar_text
Create Date: 2026-05-27

Add indexes on columns we filter or sort by in the hot paths. None
of these are required for correctness; they're production-readiness
improvements that turn sequential scans into index lookups.

Hot paths:
  - /appointments list:    WHERE starts_at BETWEEN ... AND ...
                           WHERE status = ...
                           WHERE physician_id = ...
  - /appointments/slots:   WHERE physician_id = ... AND starts_at IN day
  - /vitals list:          WHERE recorded_at >= cutoff
  - /patients list:        WHERE status = ?, risk = ?,
                           assigned_physician_id = ?
                           ORDER BY procedure_date
  - /alerts list:          WHERE resolved = false (default view)
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "0007_query_indexes"
down_revision: Union[str, None] = "0006_user_avatar_text"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Appointments
    op.create_index(
        "ix_appointments_starts_at", "appointments", ["starts_at"]
    )
    op.create_index("ix_appointments_status", "appointments", ["status"])
    # Composite for "Dr. X's day" queries.
    op.create_index(
        "ix_appointments_physician_starts_at",
        "appointments",
        ["physician_id", "starts_at"],
    )

    # Vitals — trend queries hit recorded_at constantly.
    op.create_index(
        "ix_vital_signs_recorded_at", "vital_signs", ["recorded_at"]
    )

    # Patients
    op.create_index("ix_patients_status", "patients", ["status"])
    op.create_index("ix_patients_risk", "patients", ["risk"])
    op.create_index(
        "ix_patients_assigned_physician_id",
        "patients",
        ["assigned_physician_id"],
    )
    op.create_index(
        "ix_patients_procedure_date", "patients", ["procedure_date"]
    )

    # Alerts — the strip always defaults to resolved=false.
    op.create_index(
        "ix_patient_alerts_resolved", "patient_alerts", ["resolved"]
    )


def downgrade() -> None:
    op.drop_index("ix_patient_alerts_resolved", table_name="patient_alerts")
    op.drop_index("ix_patients_procedure_date", table_name="patients")
    op.drop_index("ix_patients_assigned_physician_id", table_name="patients")
    op.drop_index("ix_patients_risk", table_name="patients")
    op.drop_index("ix_patients_status", table_name="patients")
    op.drop_index("ix_vital_signs_recorded_at", table_name="vital_signs")
    op.drop_index(
        "ix_appointments_physician_starts_at", table_name="appointments"
    )
    op.drop_index("ix_appointments_status", table_name="appointments")
    op.drop_index("ix_appointments_starts_at", table_name="appointments")
