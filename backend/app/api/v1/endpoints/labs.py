from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.lab_result import LabResult
from app.models.user import UserRole
from app.schemas.lab import LabCreate, LabOut
from app.services.audit_service import AuditService

# Labs come from clinicians or admin imports.
clinical_writer = Depends(require_roles(UserRole.provider, UserRole.admin))

router = APIRouter(prefix="/labs", tags=["labs"])


@router.get("/patient/{patient_id}", response_model=list[LabOut])
async def list_for_patient(
    patient_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth check
) -> list[LabOut]:
    result = await db.execute(
        select(LabResult)
        .where(LabResult.patient_id == patient_id)
        .order_by(LabResult.collected_at.desc())
    )
    return [LabOut.model_validate(l) for l in result.scalars().all()]


@router.post(
    "",
    response_model=LabOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[clinical_writer],
)
async def create_lab(
    payload: LabCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> LabOut:
    lab = LabResult(**payload.model_dump())
    db.add(lab)
    await db.flush()
    await db.refresh(lab)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="lab.create",
        resource_type="lab_result",
        resource_id=str(lab.id),
        payload={"patient_id": str(lab.patient_id), "name": lab.name},
    )
    return LabOut.model_validate(lab)
