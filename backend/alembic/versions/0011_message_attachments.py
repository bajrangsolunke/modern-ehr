"""message_attachments

Revision ID: 0011_message_attachments
Revises: 0010_patient_condition_tag
Create Date: 2026-05-27

Links messages to existing documents so a clinician can attach
consent forms / lab reports / imaging from the patient's chart into
the message thread.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_message_attachments"
down_revision: Union[str, None] = "0010_patient_condition_tag"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "message_attachments",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "message_id",
            sa.UUID(),
            sa.ForeignKey("messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            sa.UUID(),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_message_attachments_message_id",
        "message_attachments",
        ["message_id"],
    )
    op.create_index(
        "ix_message_attachments_document_id",
        "message_attachments",
        ["document_id"],
    )
    op.create_index(
        "uq_message_attachment",
        "message_attachments",
        ["message_id", "document_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_message_attachment", table_name="message_attachments")
    op.drop_index(
        "ix_message_attachments_document_id", table_name="message_attachments"
    )
    op.drop_index(
        "ix_message_attachments_message_id", table_name="message_attachments"
    )
    op.drop_table("message_attachments")
