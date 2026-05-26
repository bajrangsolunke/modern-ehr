from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.medication import MedicationStatus


class MedicationBase(BaseModel):
    name: str
    dose: str
    frequency: str
    route: str = "oral"
    rxnorm: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: MedicationStatus = MedicationStatus.active
    prescriber: str | None = None


class MedicationCreate(MedicationBase):
    patient_id: UUID


class MedicationUpdate(BaseModel):
    dose: str | None = None
    frequency: str | None = None
    status: MedicationStatus | None = None
    end_date: date | None = None


class MedicationOut(MedicationBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
