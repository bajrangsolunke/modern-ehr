"""Patient-scoped task feed = pending form requests + open patient
tasks. Includes a write-side for completing tasks and submitting form
requests."""
from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


PatientTaskKind = Literal["form", "task"]


class PatientTaskOut(BaseModel):
    id: UUID
    kind: PatientTaskKind
    title: str
    description: str | None = None
    status: str
    due_date: date | None = None
    created_at: datetime
    requested_by: str | None = None
    # Only set when kind == "form" — drives the form-fill modal.
    form_type: str | None = None


class PatientTaskListOut(BaseModel):
    items: list[PatientTaskOut]
    total: int
    forms_count: int
    tasks_count: int


class FormDetailOut(BaseModel):
    id: UUID
    form_type: str
    status: str
    notes: str | None = None
    due_date: date | None = None
    data: dict[str, Any] | None = None
    requested_by: str | None = None
    submitted_at: datetime | None = None


class SubmitFormIn(BaseModel):
    data: dict[str, Any] = Field(
        default_factory=dict,
        description="Form payload. Shape varies by form_type.",
    )
