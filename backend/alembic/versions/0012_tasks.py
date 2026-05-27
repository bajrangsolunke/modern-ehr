"""tasks module

Revision ID: 0012_tasks
Revises: 0011_message_attachments
Create Date: 2026-05-27

Adds the tasks workqueue table — clinical + administrative todos
with assignee, category, priority, status, and optional patient +
due date.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_tasks"
down_revision: Union[str, None] = "0011_message_attachments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TASK_CATEGORY = sa.Enum(
    "reminders",
    "document",
    "image_order",
    "lab_order",
    "referral",
    "payment",
    "unsigned_encounter",
    "other",
    name="task_category",
)
TASK_PRIORITY = sa.Enum("low", "medium", "high", name="task_priority")
TASK_STATUS = sa.Enum(
    "new", "in_progress", "completed", "cancelled", name="task_status"
)


def upgrade() -> None:
    # SQLAlchemy auto-creates the types at table-creation time. The
    # explicit pre-create runs unreliably on the async asyncpg dialect
    # (checkfirst isn't honored), so we leave it to the table.
    op.create_table(
        "tasks",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", TASK_CATEGORY, nullable=False, server_default="other"),
        sa.Column(
            "priority", TASK_PRIORITY, nullable=False, server_default="medium"
        ),
        sa.Column("status", TASK_STATUS, nullable=False, server_default="new"),
        sa.Column(
            "created_by_user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "assigned_to_user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "patient_id",
            sa.UUID(),
            sa.ForeignKey("patients.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "completed_by_user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
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
    op.create_index("ix_tasks_category", "tasks", ["category"])
    op.create_index("ix_tasks_priority", "tasks", ["priority"])
    op.create_index("ix_tasks_status", "tasks", ["status"])
    op.create_index("ix_tasks_assigned_to_user_id", "tasks", ["assigned_to_user_id"])
    op.create_index("ix_tasks_created_by_user_id", "tasks", ["created_by_user_id"])
    op.create_index("ix_tasks_patient_id", "tasks", ["patient_id"])
    op.create_index("ix_tasks_due_date", "tasks", ["due_date"])
    op.create_index("ix_tasks_created_at", "tasks", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_tasks_created_at", table_name="tasks")
    op.drop_index("ix_tasks_due_date", table_name="tasks")
    op.drop_index("ix_tasks_patient_id", table_name="tasks")
    op.drop_index("ix_tasks_created_by_user_id", table_name="tasks")
    op.drop_index("ix_tasks_assigned_to_user_id", table_name="tasks")
    op.drop_index("ix_tasks_status", table_name="tasks")
    op.drop_index("ix_tasks_priority", table_name="tasks")
    op.drop_index("ix_tasks_category", table_name="tasks")
    op.drop_table("tasks")
    TASK_STATUS.drop(op.get_bind(), checkfirst=True)
    TASK_PRIORITY.drop(op.get_bind(), checkfirst=True)
    TASK_CATEGORY.drop(op.get_bind(), checkfirst=True)
