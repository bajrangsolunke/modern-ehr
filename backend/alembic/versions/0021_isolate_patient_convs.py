"""isolate patient conversations into per-(staff, patient) threads

Revision ID: 0021_isolate_patient_convs
Revises: 0020_scribe_sessions
Create Date: 2026-05-28

Cleans up data tainted by the pre-fix `mark_read` behaviour which
auto-inserted a `ConversationParticipant` row for any staff user that
opened a patient thread. The old visibility model treated patient
threads as a team queue, so every staff member who clicked on the
list ended up persisted as a participant. With strict per-(staff,
patient) isolation, those rows leak old conversations into providers
who shouldn't see them.

What we do:
  * For every patient conversation, keep only the staff participant
    rows that match the FIRST message sender. That's the conversation's
    original owner.
  * If no staff has ever sent a message in a patient conversation
    (e.g. patient-initiated, never answered), drop ALL staff
    participant rows — first staff to reply is the new owner.

Clinician-to-clinician threads are untouched — their participant
rows have always reflected the actual thread membership.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "0021_isolate_patient_convs"
down_revision: Union[str, None] = "0020_scribe_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # For each patient conversation, find the first staff sender —
    # that's the rightful sole staff participant.
    op.execute(
        """
        WITH first_staff_sender AS (
            SELECT DISTINCT ON (m.conversation_id)
                   m.conversation_id,
                   m.sender_user_id
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE c.audience = 'patient'
              AND m.sender_user_id IS NOT NULL
            ORDER BY m.conversation_id, m.sent_at ASC
        )
        DELETE FROM conversation_participants cp
        USING conversations c
        LEFT JOIN first_staff_sender fss ON fss.conversation_id = c.id
        WHERE cp.conversation_id = c.id
          AND c.audience = 'patient'
          AND (
              fss.sender_user_id IS NULL
              OR cp.user_id <> fss.sender_user_id
          );
        """
    )


def downgrade() -> None:
    # Cannot reverse a data dedupe — we don't know which rows were
    # the spurious ones. Downgrade is a no-op.
    pass
