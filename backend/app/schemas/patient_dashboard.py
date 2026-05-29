"""Composed dashboard payload for GET /patient-portal/me/dashboard.
Each section is independent — null when there's nothing to show."""
from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

HealthMetricStatus = Literal["normal", "higher", "lower", "critical", "unknown"]


class DashboardGreeting(BaseModel):
    first_name: str


class DashboardNextAppointment(BaseModel):
    id: UUID
    starts_at: datetime
    provider_name: str | None = None
    provider_avatar_url: str | None = None
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
    sender_avatar_url: str | None = None
    preview: str
    sent_at: datetime


class DashboardRecentDocument(BaseModel):
    id: UUID
    name: str
    category: str
    created_at: datetime


class DashboardHealthMetric(BaseModel):
    """One vitals tile on the dashboard. value is a display string
    (e.g. "120/80" for BP) so the FE doesn't need to know how to
    format each metric type. series is the last ~7 readings for a
    sparkline; empty when there's only one reading."""

    metric: str          # canonical key — "heart_rate", "blood_pressure", "glucose", "weight", "hemoglobin"
    label: str           # display name — "Heart Rate"
    value: str           # "78", "120/80", "5.8"
    unit: str | None     # "bpm", "mmHg", "%", "kg", "g/dL"
    recorded_at: datetime | None
    status: HealthMetricStatus
    status_text: str | None   # "Higher than average" / "Normal" / "Lower than average"
    series: list[float] = []  # numeric history for sparkline (oldest → newest)


class DashboardProfile(BaseModel):
    gender: str | None
    age: int | None
    dob: date | None
    height_cm: float | None
    weight_kg: float | None
    avatar_url: str | None


class DashboardConditionInfo(BaseModel):
    code: str | None
    name: str
    diagnosed_at: date | None
    treatment: str | None


class DashboardAppointmentItem(BaseModel):
    id: UUID
    starts_at: datetime
    appointment_type: str | None
    status: str
    provider_name: str | None


class DashboardOut(BaseModel):
    greeting: DashboardGreeting
    profile: DashboardProfile
    health_metrics: list[DashboardHealthMetric] = []
    primary_condition: DashboardConditionInfo | None = None
    recent_appointments: list[DashboardAppointmentItem] = []
    next_appointment: DashboardNextAppointment | None = None
    pending_actions: DashboardPendingActions
    recent_message: DashboardRecentMessage | None = None
    recent_documents: list[DashboardRecentDocument] = []
