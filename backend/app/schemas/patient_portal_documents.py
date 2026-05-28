"""Patient-scoped document views."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PatientDocumentOut(BaseModel):
    id: UUID
    name: str
    category: str
    mime_type: str
    size_bytes: int
    uploaded_by: str | None = None
    created_at: datetime


class PatientDocumentListOut(BaseModel):
    items: list[PatientDocumentOut]
    total: int
