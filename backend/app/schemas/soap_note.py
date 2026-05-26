from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SoapNoteBase(BaseModel):
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None


class SoapNoteCreate(SoapNoteBase):
    patient_id: UUID


class SoapNoteUpdate(SoapNoteBase):
    pass


class SoapNoteOut(SoapNoteBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    author_id: UUID | None
    ai_summary: str | None
    version: int
    created_at: datetime
    updated_at: datetime
