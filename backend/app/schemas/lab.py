from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class LabCreate(BaseModel):
    patient_id: UUID
    name: str
    value: str
    unit: str | None = None
    loinc: str | None = None
    reference_range: str | None = None
    flag: str | None = None


class LabOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    name: str
    value: str
    unit: str | None
    loinc: str | None
    reference_range: str | None
    flag: str | None
    collected_at: datetime
