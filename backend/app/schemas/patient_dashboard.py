"""Composed dashboard payload for GET /patient-portal/me/dashboard.
Each section is independent — null when there's nothing to show."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DashboardGreeting(BaseModel):
    first_name: str


class DashboardNextAppointment(BaseModel):
    id: UUID
    starts_at: datetime
    provider_name: str | None = None
    specialty: str | None = None
    location: str | None = None
    appointment_type: str | None = None


class DashboardPendingActions(BaseModel):
    forms_count: int
    tasks_count: int
    total: int


class DashboardRecentMessage(BaseModel):
    conversation_id: UUID
    sender_name: str | None = None
    preview: str
    sent_at: datetime


class DashboardRecentDocument(BaseModel):
    id: UUID
    name: str
    category: str
    created_at: datetime


class DashboardOut(BaseModel):
    greeting: DashboardGreeting
    next_appointment: DashboardNextAppointment | None = None
    pending_actions: DashboardPendingActions
    recent_message: DashboardRecentMessage | None = None
    recent_documents: list[DashboardRecentDocument] = []
