"""
Tasks module — clinical + administrative workqueue.

A task is a unit of work with an owner (assignee), a creator, an
optional patient + due date, a priority, and a status.

Modeling choices:
  * `created_by_user_id` is nullable — system-generated tasks
    (e.g., "Please sign this encounter") set it to NULL and the UI
    renders it as "System".
  * `assigned_to_user_id` is nullable — tasks can be created as
    "Unassigned" and picked up later.
  * `patient_id` is nullable — administrative tasks (payments,
    reminders unrelated to a specific patient) aren't bound to one.
  * `completed_at` + `completed_by_user_id` capture who closed the
    task for the audit trail; unset when status moves back from
    completed.
"""
from __future__ import annotations

import enum
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class TaskCategory(str, enum.Enum):
    reminders = "reminders"
    document = "document"
    image_order = "image_order"
    lab_order = "lab_order"
    referral = "referral"
    payment = "payment"
    unsigned_encounter = "unsigned_encounter"
    other = "other"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class TaskStatus(str, enum.Enum):
    new = "new"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class Task(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tasks"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    category: Mapped[TaskCategory] = mapped_column(
        Enum(TaskCategory, name="task_category"),
        default=TaskCategory.other,
        nullable=False,
        index=True,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority, name="task_priority"),
        default=TaskPriority.medium,
        nullable=False,
        index=True,
    )
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="task_status"),
        default=TaskStatus.new,
        nullable=False,
        index=True,
    )

    # Nullable — system-generated tasks have no creator.
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    # Nullable — "Unassigned" tasks.
    assigned_to_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    # Nullable — administrative tasks not bound to a patient.
    patient_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("patients.id", ondelete="SET NULL"), index=True
    )

    due_date: Mapped[date | None] = mapped_column(Date, index=True)

    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
