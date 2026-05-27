"""messaging tables

Revision ID: 0009_messaging
Revises: 0008_documents_content
Create Date: 2026-05-27

Adds conversations, conversation_participants, and messages tables
that back the Communication module (US-COMM-1..5). Conversations are
either patient-side (patient_id set) or clinician-only (participants
only). Messages carry sender_user_id OR sender_patient_id — exactly
one is set on any given row.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_messaging"
down_revision: Union[str, None] = "0008_documents_content"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "conversations",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("audience", sa.String(length=16), nullable=False),
        sa.Column(
            "patient_id",
            sa.UUID(),
            sa.ForeignKey("patients.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column(
            "last_message_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("last_message_preview", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_conversations_audience", "conversations", ["audience"])
    op.create_index("ix_conversations_patient_id", "conversations", ["patient_id"])
    op.create_index(
        "ix_conversations_last_message_at", "conversations", ["last_message_at"]
    )

    op.create_table(
        "conversation_participants",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "conversation_id",
            sa.UUID(),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_conversation_participants_conversation_id",
        "conversation_participants",
        ["conversation_id"],
    )
    op.create_index(
        "ix_conversation_participants_user_id",
        "conversation_participants",
        ["user_id"],
    )
    op.create_index(
        "uq_conversation_participant",
        "conversation_participants",
        ["conversation_id", "user_id"],
        unique=True,
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "conversation_id",
            sa.UUID(),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "sender_patient_id",
            sa.UUID(),
            sa.ForeignKey("patients.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "urgent",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])
    op.create_index("ix_messages_sent_at", "messages", ["sent_at"])


def downgrade() -> None:
    op.drop_index("ix_messages_sent_at", table_name="messages")
    op.drop_index("ix_messages_conversation_id", table_name="messages")
    op.drop_table("messages")

    op.drop_index(
        "uq_conversation_participant", table_name="conversation_participants"
    )
    op.drop_index(
        "ix_conversation_participants_user_id",
        table_name="conversation_participants",
    )
    op.drop_index(
        "ix_conversation_participants_conversation_id",
        table_name="conversation_participants",
    )
    op.drop_table("conversation_participants")

    op.drop_index("ix_conversations_last_message_at", table_name="conversations")
    op.drop_index("ix_conversations_patient_id", table_name="conversations")
    op.drop_index("ix_conversations_audience", table_name="conversations")
    op.drop_table("conversations")
