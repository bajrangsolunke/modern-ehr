from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.alert import AlertSeverity


class AlertBase(BaseModel):
    severity: AlertSeverity = AlertSeverity.info
    label: str = Field(..., min_length=1, max_length=128)
    detail: str | None = Field(default=None, max_length=4000)


class AlertCreate(AlertBase):
    patient_id: UUID


class AlertUpdate(BaseModel):
    severity: AlertSeverity | None = None
    label: str | None = Field(default=None, min_length=1, max_length=128)
    detail: str | None = Field(default=None, max_length=4000)
    resolved: bool | None = None


class AlertOut(AlertBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    resolved: bool
    created_by_id: UUID | None
    created_at: datetime
    updated_at: datetime
