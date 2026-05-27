"""form requests workflow

Revision ID: 0013_form_requests
Revises: 0012_tasks
Create Date: 2026-05-27

Adds the form_requests table — backs the docs-flow pivot from
free-form file uploads to a structured forms workflow (consent /
intake / ROI / insurance / discharge / referral).
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0013_form_requests"
down_revision: Union[str, None] = "0012_tasks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FORM_TYPE = sa.Enum(
    "consent",
    "intake",
    "roi",
    "insurance",
    "discharge",
    "referral",
    name="form_type",
)
FORM_REQUEST_STATUS = sa.Enum(
    "pending",
    "submitted",
    "completed",
    "denied",
    name="form_request_status",
)


def upgrade() -> None:
    op.create_table(
        "form_requests",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "patient_id",
            sa.UUID(),
            sa.ForeignKey("patients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("form_type", FORM_TYPE, nullable=False),
        sa.Column(
            "status",
            FORM_REQUEST_STATUS,
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "requested_by_user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("data", postgresql.JSONB(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "submitted_by_user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "reviewed_by_user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column(
            "task_id",
            sa.UUID(),
            sa.ForeignKey("tasks.id", ondelete="SET NULL"),
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
    op.create_index("ix_form_requests_patient_id", "form_requests", ["patient_id"])
    op.create_index("ix_form_requests_form_type", "form_requests", ["form_type"])
    op.create_index("ix_form_requests_status", "form_requests", ["status"])
    op.create_index(
        "ix_form_requests_requested_by_user_id",
        "form_requests",
        ["requested_by_user_id"],
    )
    op.create_index("ix_form_requests_due_date", "form_requests", ["due_date"])


def downgrade() -> None:
    op.drop_index("ix_form_requests_due_date", table_name="form_requests")
    op.drop_index(
        "ix_form_requests_requested_by_user_id", table_name="form_requests"
    )
    op.drop_index("ix_form_requests_status", table_name="form_requests")
    op.drop_index("ix_form_requests_form_type", table_name="form_requests")
    op.drop_index("ix_form_requests_patient_id", table_name="form_requests")
    op.drop_table("form_requests")
    FORM_REQUEST_STATUS.drop(op.get_bind(), checkfirst=True)
    FORM_TYPE.drop(op.get_bind(), checkfirst=True)
