from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.patient import PatientStatus, RiskLevel


class PatientBase(BaseModel):
    mrn: str = Field(min_length=1, max_length=64)
    first_name: str
    last_name: str
    sex: str = Field(pattern="^(F|M|O)$")
    dob: date
    email: str | None = None
    phone: str | None = None
    city: str | None = None
    avatar_url: str | None = None
    procedure: str | None = None
    procedure_date: date | None = None
    asa: str | None = None
    icu_needed: bool = False
    tags: list[str] | None = None


class PatientCreate(PatientBase):
    assigned_physician_id: UUID | None = None
    risk: RiskLevel = RiskLevel.low
    status: PatientStatus = PatientStatus.scheduled


class PatientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    procedure: str | None = None
    procedure_date: date | None = None
    asa: str | None = None
    icu_needed: bool | None = None
    status: PatientStatus | None = None
    risk: RiskLevel | None = None
    risk_score: int | None = None
    tags: list[str] | None = None
    assigned_physician_id: UUID | None = None


class PatientOut(PatientBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: PatientStatus
    risk: RiskLevel
    risk_score: int
    assigned_physician_id: UUID | None


class PatientListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    mrn: str
    first_name: str
    last_name: str
    procedure: str | None
    procedure_date: date | None
    status: PatientStatus
    risk: RiskLevel
    tags: list[str] | None
    avatar_url: str | None
    assigned_physician_id: UUID | None


class PatientFilters(BaseModel):
    q: str | None = None
    status: PatientStatus | None = None
    risk: RiskLevel | None = None
    physician_id: UUID | None = None
