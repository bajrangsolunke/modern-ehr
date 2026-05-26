from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.medication import Medication
from app.models.user import UserRole
from app.schemas.medication import MedicationCreate, MedicationOut, MedicationUpdate
from app.services.audit_service import AuditService

# Only providers + admins can write to the medication list.
prescriber_only = Depends(
    require_roles(UserRole.provider, UserRole.admin)
)

router = APIRouter(prefix="/medications", tags=["medications"])


@router.get("/patient/{patient_id}", response_model=list[MedicationOut])
async def list_for_patient(
    patient_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth check
) -> list[MedicationOut]:
    result = await db.execute(
        select(Medication)
        .where(Medication.patient_id == patient_id)
        .order_by(Medication.created_at.desc())
    )
    return [MedicationOut.model_validate(m) for m in result.scalars().all()]


@router.post(
    "",
    response_model=MedicationOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[prescriber_only],
)
async def create_medication(
    payload: MedicationCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> MedicationOut:
    med = Medication(**payload.model_dump())
    db.add(med)
    await db.flush()
    await db.refresh(med)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="medication.create",
        resource_type="medication",
        resource_id=str(med.id),
        payload={"patient_id": str(med.patient_id), "name": med.name},
    )
    return MedicationOut.model_validate(med)


@router.patch(
    "/{med_id}",
    response_model=MedicationOut,
    dependencies=[prescriber_only],
)
async def update_medication(
    med_id: UUID,
    payload: MedicationUpdate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> MedicationOut:
    med = await db.get(Medication, med_id)
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(med, k, v)
    await db.flush()
    await db.refresh(med)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="medication.update",
        resource_type="medication",
        resource_id=str(med.id),
        payload=changes,
    )
    return MedicationOut.model_validate(med)


@router.delete(
    "/{med_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[prescriber_only],
)
async def delete_medication(
    med_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    med = await db.get(Medication, med_id)
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    patient_id = str(med.patient_id)
    await db.delete(med)
    await db.flush()
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="medication.delete",
        resource_type="medication",
        resource_id=str(med_id),
        payload={"patient_id": patient_id},
    )
