"""Notification schemas + the canonical kind/urgency enums.

The full kind catalogue lives here (not in the model) so it's easy to
diff in code review and so adding a new trigger is a one-line change.
The FE imports the same names from its mirror.
"""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------- catalogue


NotificationKind = Literal[
    # Appointments
    "appointment_booked",
    "appointment_today",
    "appointment_cancelled",
    "appointment_rescheduled",
    "appointment_reminder_24h",
    "appointment_reminder_1h",
    "appointment_no_show",
    "patient_checked_in",
    # Care team
    "patient_assigned",
    # Tasks
    "task_assigned",
    "task_due_soon",
    "task_overdue",
    # Forms
    "form_assigned",
    "form_due_soon",
    "form_overdue",
    "form_submitted",
    "form_approved",
    "form_denied",
    # Messages
    "new_message",
    # Clinical
    "lab_result_returned",
    "lab_result_available",
    "critical_patient_alert",
    "unsigned_encounter",
    "patient_vitals_submitted",
    "patient_document_uploaded",
    "referral_status_update",
    "prescription_ready",
    "visit_summary_ready",
    # Admin / system
    "schedule_changed",
    "account_security_event",
    # Legacy / catch-all
    "generic",
]


NotificationUrgency = Literal["critical", "high", "normal", "low"]


# ---------------------------------------------------------------- I/O


class NotificationCreate(BaseModel):
    """Legacy free-form create — kept for back-compat with the REST
    POST endpoint. New code uses `NotificationService.dispatch()` which
    fills in `kind` + `urgency` + `link` explicitly."""

    user_id: UUID
    title: str
    body: str | None = None
    severity: str = "info"
    source: str = "system"


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str
    body: str | None
    kind: NotificationKind = "generic"
    urgency: NotificationUrgency = "normal"
    related_type: str | None = None
    related_id: UUID | None = None
    link: str | None = None
    severity: str
    source: str
    is_read: bool
    created_at: datetime
