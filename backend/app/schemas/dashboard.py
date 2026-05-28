"""Pydantic schemas for the provider dashboard snapshot.

The dashboard feeds two compact cards on the right rail:
  - Requested tasks for the signed-in user (open work pinned to me)
  - Unread message activity (small notification card)

Cards on the left rail (KPIs, charts) are still driven by mock data —
those move under this endpoint once we have real telemetry. For now
this endpoint is intentionally narrow.
"""
from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.task import TaskPriorityLiteral, TaskStatusLiteral

# Mirror the persisted `task_type` enum on the model. Inlined here so
# the dashboard schema doesn't have to wait on whatever is in flux
# in app.schemas.task.
TaskTypeLiteral = Literal["user", "patient"]


class DashboardTaskOut(BaseModel):
    """A single requested-task row on the dashboard card."""

    id: UUID
    title: str
    priority: TaskPriorityLiteral
    status: TaskStatusLiteral
    task_type: TaskTypeLiteral
    due_date: date | None = None
    patient_id: UUID | None = None
    patient_name: str | None = None
    created_at: datetime


class DashboardMessageOut(BaseModel):
    """A single unread-conversation row on the messages notification card."""

    conversation_id: UUID
    sender_name: str
    preview: str
    sent_at: datetime
    unread_count: int


class DashboardSnapshot(BaseModel):
    """Top-level payload returned by GET /dashboard.

    `requested_tasks` is capped to a small page (`requested_tasks_total`
    is the full count so the card can show "+12 more"). Same idea for
    messages — `recent_unread_messages` is the preview rows, and
    `unread_messages_count` is the global sum.
    """

    requested_tasks: list[DashboardTaskOut]
    requested_tasks_total: int
    unread_messages_count: int
    recent_unread_messages: list[DashboardMessageOut]
