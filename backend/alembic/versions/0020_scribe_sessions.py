"""scribe (ambient documentation) sessions, transcripts, soap_ai, icd suggestions, icd catalog

Revision ID: 0020_scribe_sessions
Revises: 0019_notification_kinds
Create Date: 2026-05-28

Adds the tables that back the MedScribe-style ambient-documentation
workflow. A provider records an encounter, audio is streamed in 4-s
chunks to Whisper for live transcription, then a finalize pipeline
asks the LLM to draft SOAP, suggest ICD-10 codes, and write a visit
summary. Five new tables:

  * scribe_sessions      — one row per "I clicked record"
  * scribe_transcripts   — per-chunk audit log (transcript_text on the
                            session row is the denormalized source of
                            truth the pipeline reads)
  * scribe_soap_notes    — AI-drafted S/O/A/P for a session (separate
                            from the existing `soap_notes` table so
                            we don't muddy clinician-signed notes with
                            AI drafts)
  * scribe_icd_suggestions — LLM-suggested codes, each marked
                              is_validated based on icd_catalog lookup
  * icd_catalog          — seed table of CMS ICD-10-CM codes
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0020_scribe_sessions"
down_revision: Union[str, None] = "0019_notification_kinds"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SCRIBE_STATUS = PG_ENUM(
    "created",
    "recording",
    "processing",
    "completed",
    "failed",
    name="scribe_session_status",
    create_type=False,  # we CREATE TYPE explicitly below; otherwise the
    # column reference auto-emits CREATE TYPE a second time and fails on
    # asyncpg. PG_ENUM (postgresql.ENUM) honours create_type=False reliably,
    # unlike sa.Enum which still emits the CREATE TYPE in some paths.
)


def upgrade() -> None:
    # CREATE TYPE IF NOT EXISTS isn't supported in PostgreSQL, and
    # asyncpg's transactional DDL can leave the enum behind after a
    # rollback. Guard with a DO block.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scribe_session_status') THEN
                CREATE TYPE scribe_session_status AS ENUM
                    ('created', 'recording', 'processing', 'completed', 'failed');
            END IF;
        END$$;
        """
    )

    # ---------- icd_catalog ----------
    op.create_table(
        "icd_catalog",
        sa.Column("code", sa.String(length=16), primary_key=True),
        sa.Column("short_description", sa.String(length=255), nullable=False),
        sa.Column("long_description", sa.Text(), nullable=True),
        sa.Column("chapter", sa.String(length=128), nullable=True),
    )

    # ---------- scribe_sessions ----------
    op.create_table(
        "scribe_sessions",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "patient_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("chief_complaint", sa.String(length=512), nullable=True),
        sa.Column("status", SCRIBE_STATUS, nullable=False, server_default="created"),
        # Denormalized transcript so the finalize pipeline doesn't have
        # to re-assemble from chunks.
        sa.Column("transcript_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("visit_summary", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ---------- scribe_transcripts (per-chunk audit) ----------
    op.create_table(
        "scribe_transcripts",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "session_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("scribe_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("session_id", "sequence", name="uq_scribe_transcripts_seq"),
    )

    # ---------- scribe_soap_notes ----------
    op.create_table(
        "scribe_soap_notes",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "session_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("scribe_sessions.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("subjective", sa.Text(), nullable=False, server_default=""),
        sa.Column("objective", sa.Text(), nullable=False, server_default=""),
        sa.Column("assessment", sa.Text(), nullable=False, server_default=""),
        sa.Column("plan", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ---------- scribe_icd_suggestions ----------
    op.create_table(
        "scribe_icd_suggestions",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "session_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("scribe_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("description", sa.String(length=512), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("reasoning", sa.Text(), nullable=True),
        # The catalog lookup result. False means the LLM hallucinated a
        # code that doesn't exist in the CMS catalog — we KEEP the row
        # but mark it so the UI can show a warning.
        sa.Column(
            "is_validated", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "accepted_by_user", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("scribe_icd_suggestions")
    op.drop_table("scribe_soap_notes")
    op.drop_table("scribe_transcripts")
    op.drop_table("scribe_sessions")
    op.drop_table("icd_catalog")
    op.execute("DROP TYPE IF EXISTS scribe_session_status")
