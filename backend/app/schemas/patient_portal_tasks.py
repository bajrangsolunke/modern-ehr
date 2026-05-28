"""Patient-scoped task feed = pending form requests + open patient
tasks. Read-only for now — submission is a separate flow."""
from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


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


class PatientTaskListOut(BaseModel):
    items: list[PatientTaskOut]
    total: int
    forms_count: int
    tasks_count: int
