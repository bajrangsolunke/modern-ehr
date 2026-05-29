"""telehealth sessions + transcript segments

Revision ID: 0023_telehealth
Revises: 0022_lab_source_document
Create Date: 2026-05-28

Adds two tables:
  * telehealth_sessions — one row per video visit, owned by an
    appointment. Holds the Daily room name/URL, lifecycle status,
    consent + start/end timestamps.
  * transcript_segments — one row per speaker-attributed utterance.
    Append-only; we never edit a segment after the client posts it.

Also extends `soap_notes` with a nullable `telehealth_session_id`
FK so generated drafts trace back to their source transcript.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM

revision: str = "0023_telehealth"
down_revision: Union[str, None] = "0022_lab_source_document"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# We CREATE TYPE explicitly via a DO $$ guard block (mirroring 0020)
# because asyncpg's transactional DDL can leave enums behind on rollback
# and CREATE TYPE IF NOT EXISTS isn't supported in PostgreSQL. The column
# references below set create_type=False so the table-create path won't
# emit a second CREATE TYPE.
SESSION_STATUS = PG_ENUM(
    "scheduled",
    "patient_consented",
    "active",
    "ended",
    "cancelled",
    name="telehealth_session_status",
    create_type=False,
)
SPEAKER_ROLE = PG_ENUM(
    "provider",
    "patient",
    "unknown",
    name="telehealth_speaker_role",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'telehealth_session_status') THEN
                CREATE TYPE telehealth_session_status AS ENUM
                    ('scheduled', 'patient_consented', 'active', 'ended', 'cancelled');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'telehealth_speaker_role') THEN
                CREATE TYPE telehealth_speaker_role AS ENUM
                    ('provider', 'patient', 'unknown');
            END IF;
        END$$;
        """
    )

    op.create_table(
        "telehealth_sessions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "appointment_id",
            sa.UUID(),
            sa.ForeignKey("appointments.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("daily_room_name", sa.String(96), nullable=False, unique=True),
        sa.Column("daily_room_url", sa.String(512), nullable=False),
        sa.Column("status", SESSION_STATUS, nullable=False, server_default="scheduled"),
        sa.Column("patient_consented_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index(
        "ix_telehealth_sessions_status",
        "telehealth_sessions",
        ["status"],
    )

    op.create_table(
        "transcript_segments",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "session_id",
            sa.UUID(),
            sa.ForeignKey("telehealth_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("speaker_role", SPEAKER_ROLE, nullable=False),
        sa.Column("daily_participant_id", sa.String(96), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("start_offset_ms", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_transcript_segments_session_start",
        "transcript_segments",
        ["session_id", "start_offset_ms"],
    )

    op.add_column(
        "soap_notes",
        sa.Column(
            "telehealth_session_id",
            sa.UUID(),
            sa.ForeignKey("telehealth_sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("soap_notes", "telehealth_session_id")
    op.drop_index(
        "ix_transcript_segments_session_start", table_name="transcript_segments"
    )
    op.drop_table("transcript_segments")
    op.drop_index(
        "ix_telehealth_sessions_status", table_name="telehealth_sessions"
    )
    op.drop_table("telehealth_sessions")
    op.execute("DROP TYPE IF EXISTS telehealth_speaker_role")
    op.execute("DROP TYPE IF EXISTS telehealth_session_status")
