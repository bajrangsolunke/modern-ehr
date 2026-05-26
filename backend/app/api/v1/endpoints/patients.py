from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.patient import PatientStatus, RiskLevel
from app.models.user import UserRole
from app.schemas.common import Page
from app.schemas.patient import (
    PatientCreate,
    PatientFilters,
    PatientListItem,
    PatientOut,
    PatientUpdate,
)
from app.services.audit_service import AuditService
from app.services.patient_service import PatientService

# Writes (create/update/delete) are restricted to providers + admins.
# Reads stay open to any active authenticated user — staff still need
# to see patient lists for scheduling.
write_role_dep = Depends(
    require_roles(
        UserRole.provider,
        UserRole.admin,
    )
)

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
    asa: str | None = Query(None, pattern="^(I|II|III|IV)$"),
    icu_needed: bool | None = None,
    physician_id: UUID | None = None,
    sort_by: str = Query(
        "created_at",
        pattern="^(mrn|first_name|procedure_date|risk_score|created_at)$",
    ),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
) -> Page[PatientListItem]:
    filters = PatientFilters(
        q=q,
        status=status,
        risk=risk,
        asa=asa,  # type: ignore[arg-type]
        icu_needed=icu_needed,
        physician_id=physician_id,
        sort_by=sort_by,  # type: ignore[arg-type]
        sort_dir=sort_dir,  # type: ignore[arg-type]
    )
    return await PatientService(db).list(filters, page=page, page_size=page_size)


@router.post(
    "",
    response_model=PatientOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[write_role_dep],
)
async def create_patient(
    payload: PatientCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> PatientOut:
    patient = await PatientService(db).create(payload)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="patient.create",
        resource_type="patient",
        resource_id=str(patient.id),
    )
    return PatientOut.model_validate(patient)


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> PatientOut:
    patient = await PatientService(db).get(patient_id)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="patient.read",
        resource_type="patient",
        resource_id=str(patient.id),
    )
    return PatientOut.model_validate(patient)


@router.patch(
    "/{patient_id}",
    response_model=PatientOut,
    dependencies=[write_role_dep],
)
async def update_patient(
    patient_id: UUID,
    payload: PatientUpdate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> PatientOut:
    patient = await PatientService(db).update(patient_id, payload)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="patient.update",
        resource_type="patient",
        resource_id=str(patient.id),
        payload=payload.model_dump(exclude_unset=True),
    )
    return PatientOut.model_validate(patient)


@router.delete(
    "/{patient_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[write_role_dep],
)
async def delete_patient(
    patient_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    await PatientService(db).delete(patient_id)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="patient.delete",
        resource_type="patient",
        resource_id=str(patient_id),
    )
