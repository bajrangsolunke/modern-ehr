"""add patient_last_read_at to conversations for patient-side read receipts

Revision ID: 0018_conversation_patient_read
Revises: 0017_ai_insight_cache
Create Date: 2026-05-28

The provider portal tracks staff read state via `conversation_participants.
last_read_at`. The patient is an implicit participant (Conversation.
patient_id) so we need a separate column to know when the patient last
opened the thread. Drives the double-tick (✓✓) on outgoing bubbles in
both portals.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018_conversation_patient_read"
down_revision: Union[str, None] = "0017_ai_insight_cache"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column(
            "patient_last_read_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("conversations", "patient_last_read_at")
