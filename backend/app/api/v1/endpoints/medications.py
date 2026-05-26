from uuid import UUID

from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.medication import Medication
from app.schemas.medication import MedicationCreate, MedicationOut, MedicationUpdate

router = APIRouter(prefix="/medications", tags=["medications"])


@router.get("/patient/{patient_id}", response_model=list[MedicationOut])
async def list_for_patient(
    patient_id: UUID, db: DbSession, current: CurrentUser
) -> list[MedicationOut]:
    result = await db.execute(select(Medication).where(Medication.patient_id == patient_id))
    return [MedicationOut.model_validate(m) for m in result.scalars().all()]


@router.post("", response_model=MedicationOut, status_code=status.HTTP_201_CREATED)
async def create_medication(
    payload: MedicationCreate, db: DbSession, current: CurrentUser
) -> MedicationOut:
    med = Medication(**payload.model_dump())
    db.add(med)
    await db.flush()
    await db.refresh(med)
    return MedicationOut.model_validate(med)


@router.patch("/{med_id}", response_model=MedicationOut)
async def update_medication(
    med_id: UUID,
    payload: MedicationUpdate,
    db: DbSession,
    current: CurrentUser,
) -> MedicationOut:
    med = await db.get(Medication, med_id)
    if not med:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Medication not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(med, k, v)
    await db.flush()
    await db.refresh(med)
    return MedicationOut.model_validate(med)
