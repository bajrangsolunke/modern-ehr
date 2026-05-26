from uuid import UUID

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import Page
from app.schemas.patient import (
    PatientCreate,
    PatientFilters,
    PatientListItem,
    PatientOut,
    PatientUpdate,
)
from app.models.patient import PatientStatus, RiskLevel
from app.services.patient_service import PatientService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("", response_model=Page[PatientListItem])
async def list_patients(
    db: DbSession,
    current: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = None,
    status: PatientStatus | None = None,
    risk: RiskLevel | None = None,
    physician_id: UUID | None = None,
) -> Page[PatientListItem]:
    filters = PatientFilters(
        q=q, status=status, risk=risk, physician_id=physician_id
    )
    return await PatientService(db).list(filters, page=page, page_size=page_size)


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload: PatientCreate, db: DbSession, current: CurrentUser
) -> PatientOut:
    patient = await PatientService(db).create(payload)
    await AuditService(db).record(
        user_id=current.id,
        action="patient.create",
        resource_type="patient",
        resource_id=str(patient.id),
    )
    return PatientOut.model_validate(patient)


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: UUID, db: DbSession, current: CurrentUser
) -> PatientOut:
    patient = await PatientService(db).get(patient_id)
    await AuditService(db).record(
        user_id=current.id,
        action="patient.read",
        resource_type="patient",
        resource_id=str(patient.id),
    )
    return PatientOut.model_validate(patient)


@router.patch("/{patient_id}", response_model=PatientOut)
async def update_patient(
    patient_id: UUID,
    payload: PatientUpdate,
    db: DbSession,
    current: CurrentUser,
) -> PatientOut:
    patient = await PatientService(db).update(patient_id, payload)
    await AuditService(db).record(
        user_id=current.id,
        action="patient.update",
        resource_type="patient",
        resource_id=str(patient.id),
        payload=payload.model_dump(exclude_unset=True),
    )
    return PatientOut.model_validate(patient)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: UUID, db: DbSession, current: CurrentUser
) -> None:
    await PatientService(db).delete(patient_id)
    await AuditService(db).record(
        user_id=current.id,
        action="patient.delete",
        resource_type="patient",
        resource_id=str(patient_id),
    )
