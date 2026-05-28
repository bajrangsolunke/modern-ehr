"""add task_type column to tasks

Revision ID: 0015_task_type
Revises: 0014_patient_portal_auth
Create Date: 2026-05-28

Adds the task_type discriminator to the tasks workqueue so the
patient-facing queue and the team queue can be filtered cheaply.

Backfill rule: a task is a "patient" task only when it has a
patient_id AND no user assignee — every other shape stays as a
"user" task (team queue, including unassigned).
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015_task_type"
down_revision: Union[str, None] = "0014_patient_portal_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TASK_TYPE = sa.Enum("user", "patient", name="task_type")


def upgrade() -> None:
    TASK_TYPE.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "tasks",
        sa.Column(
            "task_type",
            TASK_TYPE,
            nullable=False,
            server_default="user",
        ),
    )

    op.create_index("ix_tasks_task_type", "tasks", ["task_type"])

    # Backfill: tasks with a patient and no user assignee become
    # patient-typed. Everything else stays user.
    op.execute(
        """
        UPDATE tasks
           SET task_type = 'patient'
         WHERE patient_id IS NOT NULL
           AND assigned_to_user_id IS NULL
        """
    )

    # Drop the server_default — application code is the source of
    # truth going forward.
    op.alter_column("tasks", "task_type", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_tasks_task_type", table_name="tasks")
    op.drop_column("tasks", "task_type")
    TASK_TYPE.drop(op.get_bind(), checkfirst=True)
