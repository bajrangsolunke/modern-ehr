"""Patient-scoped form-request listing — separate from tasks so the
Forms tab on the Documents page doesn't need to filter the merged
tasks payload."""
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class PatientFormRequestOut(BaseModel):
    id: UUID
    form_type: str
    status: str
    notes: str | None = None
    due_date: date | None = None
    created_at: datetime
    submitted_at: datetime | None = None
    requested_by: str | None = None


class PatientFormRequestListOut(BaseModel):
    items: list[PatientFormRequestOut]
    pending: int
    submitted: int
    completed: int
