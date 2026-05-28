"""Pydantic schemas for the provider dashboard snapshot.

The dashboard feeds two compact cards on the right rail:
  - Requested tasks for the signed-in user (open work pinned to me)
  - Unread message activity (small notification card)

Cards on the left rail (KPIs, charts) are still driven by mock data —
those move under this endpoint once we have real telemetry. For now
this endpoint is intentionally narrow.
"""
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.task import TaskPriorityLiteral, TaskStatusLiteral, TaskTypeLiteral


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


class DashboardLatestMessage(BaseModel):
    """The most recent message the viewer has in any conversation they
    participate in. Drives the compact "Latest message" strip under
    the Requested Tasks card."""

    conversation_id: UUID
    sender_name: str | None = None
    preview: str
    sent_at: datetime


class DashboardSnapshot(BaseModel):
    """Top-level payload returned by GET /dashboard.

    `requested_tasks` is capped to a small page (`requested_tasks_total`
    is the full count so the card can show "+12 more"). For messages
    we keep a single `latest_message` (matches the patient-portal
    pattern — see `DashboardOut.recent_message`) plus the global
    `unread_messages_count` for the inline badge.
    """

    requested_tasks: list[DashboardTaskOut]
    requested_tasks_total: int
    unread_messages_count: int
    latest_message: DashboardLatestMessage | None = None
