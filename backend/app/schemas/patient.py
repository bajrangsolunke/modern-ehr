from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.patient import PatientStatus, RiskLevel

# ASA Physical Status Classification — only these values are clinically valid.
AsaClass = Literal["I", "II", "III", "IV"]
Sex = Literal["F", "M", "O"]


class PatientBase(BaseModel):
    mrn: str = Field(min_length=1, max_length=64)
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    sex: Sex
    dob: date
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=64)
    city: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = None
    procedure: str | None = Field(default=None, max_length=255)
    procedure_date: date | None = None
    asa: AsaClass | None = None
    icu_needed: bool = False
    tags: list[str] | None = None

    @field_validator("dob")
    @classmethod
    def _dob_not_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return v


class PatientCreate(PatientBase):
    assigned_physician_id: UUID | None = None
    risk: RiskLevel = RiskLevel.low
    status: PatientStatus = PatientStatus.scheduled


class PatientUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=128)
    last_name: str | None = Field(default=None, min_length=1, max_length=128)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=64)
    city: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=2_000_000)
    procedure: str | None = Field(default=None, max_length=255)
    procedure_date: date | None = None
    asa: AsaClass | None = None
    icu_needed: bool | None = None
    status: PatientStatus | None = None
    risk: RiskLevel | None = None
    tags: list[str] | None = None
    assigned_physician_id: UUID | None = None
    # Intentionally NOT exposed: risk_score (server-derived), mrn (immutable
    # after create), sex/dob (clinically immutable — needs a separate flow).


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


SortBy = Literal["mrn", "first_name", "procedure_date", "risk_score", "created_at"]
SortDir = Literal["asc", "desc"]


class PatientFilters(BaseModel):
    q: str | None = None
    status: PatientStatus | None = None
    risk: RiskLevel | None = None
    asa: AsaClass | None = None
    icu_needed: bool | None = None
    physician_id: UUID | None = None
    sort_by: SortBy = "created_at"
    sort_dir: SortDir = "desc"
