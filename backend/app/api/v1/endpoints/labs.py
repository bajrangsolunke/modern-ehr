from uuid import UUID

from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.lab_result import LabResult
from app.schemas.lab import LabCreate, LabOut

router = APIRouter(prefix="/labs", tags=["labs"])


@router.get("/patient/{patient_id}", response_model=list[LabOut])
async def list_for_patient(
    patient_id: UUID, db: DbSession, current: CurrentUser
) -> list[LabOut]:
    result = await db.execute(
        select(LabResult).where(LabResult.patient_id == patient_id).order_by(LabResult.collected_at.desc())
    )
    return [LabOut.model_validate(l) for l in result.scalars().all()]


@router.post("", response_model=LabOut, status_code=status.HTTP_201_CREATED)
async def create_lab(
    payload: LabCreate, db: DbSession, current: CurrentUser
) -> LabOut:
    lab = LabResult(**payload.model_dump())
    db.add(lab)
    await db.flush()
    await db.refresh(lab)
    return LabOut.model_validate(lab)
