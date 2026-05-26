from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class VitalCreate(BaseModel):
    patient_id: UUID
    metric: str
    value: float
    unit: str | None = None
    source: str = "manual"


class VitalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    metric: str
    value: float
    unit: str | None
    recorded_at: datetime
    source: str
