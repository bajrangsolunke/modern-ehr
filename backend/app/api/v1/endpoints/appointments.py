from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentUpdate,
)
from app.services.appointment_service import AppointmentService

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.get("", response_model=list[AppointmentOut])
async def list_appointments(
    db: DbSession, current: CurrentUser, limit: int = 50
) -> list[AppointmentOut]:
    items = await AppointmentService(db).list_upcoming(limit=limit)
    return [AppointmentOut.model_validate(i) for i in items]


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreate, db: DbSession, current: CurrentUser
) -> AppointmentOut:
    appt = await AppointmentService(db).create(payload)
    return AppointmentOut.model_validate(appt)


@router.get("/patient/{patient_id}", response_model=list[AppointmentOut])
async def for_patient(
    patient_id: UUID, db: DbSession, current: CurrentUser
) -> list[AppointmentOut]:
    items = await AppointmentService(db).list_for_patient(patient_id)
    return [AppointmentOut.model_validate(i) for i in items]


@router.patch("/{appt_id}", response_model=AppointmentOut)
async def update_appointment(
    appt_id: UUID,
    payload: AppointmentUpdate,
    db: DbSession,
    current: CurrentUser,
) -> AppointmentOut:
    appt = await AppointmentService(db).update(appt_id, payload)
    return AppointmentOut.model_validate(appt)
