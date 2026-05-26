from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# Metric whitelist — keeps the chart deterministic and prevents arbitrary
# free-form metrics from polluting the schema. Extend deliberately.
VitalMetric = Literal[
    "heart_rate",
    "systolic_bp",
    "diastolic_bp",
    "temperature_c",
    "spo2",
    "respiratory_rate",
    "weight_kg",
    "height_cm",
    "bmi",
    "pain",
]

VitalSource = Literal["manual", "device", "imported"]


class VitalBase(BaseModel):
    metric: VitalMetric
    value: float = Field(..., ge=0, le=1000)
    unit: str | None = Field(default=None, max_length=32)
    source: VitalSource = "manual"


class VitalCreate(VitalBase):
    patient_id: UUID
    # Optional: clinicians may backfill a reading taken earlier.
    recorded_at: datetime | None = None


class VitalUpdate(BaseModel):
    value: float | None = Field(default=None, ge=0, le=1000)
    unit: str | None = Field(default=None, max_length=32)
    recorded_at: datetime | None = None


class VitalOut(VitalBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    recorded_at: datetime
