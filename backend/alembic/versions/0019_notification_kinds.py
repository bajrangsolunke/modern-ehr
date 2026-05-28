"""extend notifications with typed kind/urgency + deep-link metadata

Revision ID: 0019_notification_kinds
Revises: 0018_conversation_patient_read
Create Date: 2026-05-28

The existing notifications row was stringly-typed (`severity`, `source`,
`title`, `body`). To support routed UX (badge color, OS toast, deep-
link to the source row), we add:

  * `kind` — discriminator the FE switches on for icon/copy
  * `urgency` — drives badge color + whether an OS toast fires
  * `related_type` / `related_id` — what backed this notification
  * `link` — frontend route the user lands on when they click

`severity` and `source` stay for back-compat — older code that wrote
them still works. New code uses the typed columns.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019_notification_kinds"
down_revision: Union[str, None] = "0018_conversation_patient_read"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("kind", sa.String(48), nullable=False, server_default="generic"),
    )
    op.add_column(
        "notifications",
        sa.Column("urgency", sa.String(16), nullable=False, server_default="normal"),
    )
    op.add_column(
        "notifications",
        sa.Column("related_type", sa.String(48), nullable=True),
    )
    op.add_column(
        "notifications",
        sa.Column("related_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "notifications",
        sa.Column("link", sa.String(512), nullable=True),
    )

    # Backfill urgency from the legacy `severity` column so older rows
    # render with sensible colors. Mapping mirrors the FE convention.
    op.execute(
        """
        UPDATE notifications
           SET urgency = CASE severity
               WHEN 'critical' THEN 'critical'
               WHEN 'warning'  THEN 'high'
               WHEN 'info'     THEN 'normal'
               ELSE 'normal'
           END
        """
    )

    # Drop the defaults — application code is the source of truth now.
    op.alter_column("notifications", "kind", server_default=None)
    op.alter_column("notifications", "urgency", server_default=None)

    op.create_index("ix_notifications_kind", "notifications", ["kind"])
    op.create_index(
        "ix_notifications_related",
        "notifications",
        ["related_type", "related_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_related", table_name="notifications")
    op.drop_index("ix_notifications_kind", table_name="notifications")
    op.drop_column("notifications", "link")
    op.drop_column("notifications", "related_id")
    op.drop_column("notifications", "related_type")
    op.drop_column("notifications", "urgency")
    op.drop_column("notifications", "kind")
