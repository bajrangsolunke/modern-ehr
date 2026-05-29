from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.appointment import AppointmentModality, AppointmentStatus, AppointmentType


class AppointmentBase(BaseModel):
    patient_id: UUID
    physician_id: UUID | None = None
    service_catalog_id: UUID | None = None
    type: AppointmentType = AppointmentType.consultation
    modality: AppointmentModality = AppointmentModality.in_person
    starts_at: datetime
    duration_minutes: int = Field(30, ge=5, le=480)
    room: str | None = Field(default=None, max_length=64)
    reason: str | None = Field(default=None, max_length=512)


class AppointmentCreate(AppointmentBase):
    status: AppointmentStatus = AppointmentStatus.scheduled


class AppointmentUpdate(BaseModel):
    physician_id: UUID | None = None
    type: AppointmentType | None = None
    modality: AppointmentModality | None = None
    status: AppointmentStatus | None = None
    starts_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=480)
    room: str | None = Field(default=None, max_length=64)
    reason: str | None = Field(default=None, max_length=512)


class AppointmentOut(AppointmentBase):
    """
    Read shape. Includes flattened patient + physician names so the
    list view doesn't have to N+1-fetch every row. Names come from a
    joinedload in the service.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: AppointmentStatus
    patient_name: str | None = None
    patient_mrn: str | None = None
    patient_avatar_url: str | None = None
    physician_name: str | None = None
    service_code: str | None = None
    invoice_id: UUID | None = None
    invoice_total_cents: int | None = None
    invoice_balance_cents: int | None = None

    @model_validator(mode="before")
    @classmethod
    def _flatten_relationships(cls, data):
        # When constructed from a SQLAlchemy row, pull the relationship
        # fields into the flat name slots.
        patient = getattr(data, "patient", None) if not isinstance(data, dict) else None
        physician = getattr(data, "physician", None) if not isinstance(data, dict) else None
        if patient is None and physician is None:
            return data
        extras: dict = {}
        if patient is not None:
            extras["patient_name"] = (
                f"{patient.first_name} {patient.last_name}".strip()
            )
            extras["patient_mrn"] = patient.mrn
            extras["patient_avatar_url"] = patient.avatar_url
        if physician is not None:
            extras["physician_name"] = physician.full_name
        return _RowWithExtras(data, extras)


class _RowWithExtras:
    """Attribute proxy that overlays a dict of extras on a SQLAlchemy row."""

    def __init__(self, row, extras: dict):
        self._row = row
        self._extras = extras

    def __getattr__(self, item):
        if item in self._extras:
            return self._extras[item]
        return getattr(self._row, item)


SortBy = Literal["starts_at", "created_at"]
SortDir = Literal["asc", "desc"]


class AppointmentStats(BaseModel):
    today: int
    this_week: int
    cancellations_this_week: int
    no_shows_this_week: int


def attach_billing(
    row,
    *,
    service_code: str | None,
    invoice_id: UUID | None,
    invoice_total_cents: int | None,
    invoice_balance_cents: int | None,
):
    """Attach billing extras onto a SQLAlchemy Appointment row so
    AppointmentOut.model_validate picks them up."""
    setattr(row, "service_code", service_code)
    setattr(row, "invoice_id", invoice_id)
    setattr(row, "invoice_total_cents", invoice_total_cents)
    setattr(row, "invoice_balance_cents", invoice_balance_cents)
    return row
