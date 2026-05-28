"""patient portal auth columns

Revision ID: 0014_patient_portal_auth
Revises: 0013_form_requests
Create Date: 2026-05-28

Adds the five columns the patient portal needs to authenticate
patients: hashed_password (bcrypt, null until activated),
portal_active (login gate), email_verified_at (flips at setup),
and a reset_token + expiry pair for one-time invite + reset URLs.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_patient_portal_auth"
down_revision: Union[str, None] = "0013_form_requests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "patients",
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "patients",
        sa.Column(
            "portal_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "patients",
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "patients",
        sa.Column(
            "password_reset_token", sa.String(length=128), nullable=True
        ),
    )
    op.add_column(
        "patients",
        sa.Column(
            "password_reset_expires", sa.DateTime(timezone=True), nullable=True
        ),
    )
    op.create_index(
        "ix_patients_password_reset_token",
        "patients",
        ["password_reset_token"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_patients_password_reset_token", table_name="patients"
    )
    op.drop_column("patients", "password_reset_expires")
    op.drop_column("patients", "password_reset_token")
    op.drop_column("patients", "email_verified_at")
    op.drop_column("patients", "portal_active")
    op.drop_column("patients", "hashed_password")
