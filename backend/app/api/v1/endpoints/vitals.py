from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.user import UserRole
from app.models.vital import VitalSign
from app.schemas.vital import VitalCreate, VitalOut, VitalUpdate
from app.services.audit_service import AuditService

# Nurses also record vitals — wider write role than other endpoints.
clinical_writer = Depends(
    require_roles(
        UserRole.physician,
        UserRole.surgeon,
        UserRole.nurse,
        UserRole.admin,
    )
)

router = APIRouter(prefix="/vitals", tags=["vitals"])


@router.get("/patient/{patient_id}", response_model=list[VitalOut])
async def list_for_patient(
    patient_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth check
    metric: str | None = Query(None, description="Filter to a single metric"),
    since_hours: int | None = Query(
        None,
        ge=1,
        le=24 * 30,
        description="Limit to readings from the last N hours",
    ),
    limit: int = Query(500, ge=1, le=5000),
) -> list[VitalOut]:
    stmt = select(VitalSign).where(VitalSign.patient_id == patient_id)
    if metric:
        stmt = stmt.where(VitalSign.metric == metric)
    if since_hours:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
        stmt = stmt.where(VitalSign.recorded_at >= cutoff)
    stmt = stmt.order_by(VitalSign.recorded_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return [VitalOut.model_validate(v) for v in result.scalars().all()]


@router.post(
    "",
    response_model=VitalOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[clinical_writer],
)
async def create_vital(
    payload: VitalCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> VitalOut:
    data = payload.model_dump()
    # Drop None recorded_at so the DB server_default fires.
    if data.get("recorded_at") is None:
        data.pop("recorded_at", None)
    reading = VitalSign(**data)
    db.add(reading)
    await db.flush()
    await db.refresh(reading)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="vital.create",
        resource_type="vital",
        resource_id=str(reading.id),
        payload={
            "patient_id": str(reading.patient_id),
            "metric": reading.metric,
            "value": float(reading.value),
        },
    )
    return VitalOut.model_validate(reading)


@router.patch(
    "/{vital_id}",
    response_model=VitalOut,
    dependencies=[clinical_writer],
)
async def update_vital(
    vital_id: UUID,
    payload: VitalUpdate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> VitalOut:
    reading = await db.get(VitalSign, vital_id)
    if not reading:
        raise HTTPException(status_code=404, detail="Vital reading not found")
    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(reading, k, v)
    await db.flush()
    await db.refresh(reading)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="vital.update",
        resource_type="vital",
        resource_id=str(reading.id),
        payload=changes,
    )
    return VitalOut.model_validate(reading)


@router.delete(
    "/{vital_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[clinical_writer],
)
async def delete_vital(
    vital_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    reading = await db.get(VitalSign, vital_id)
    if not reading:
        raise HTTPException(status_code=404, detail="Vital reading not found")
    patient_id = str(reading.patient_id)
    await db.delete(reading)
    await db.flush()
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="vital.delete",
        resource_type="vital",
        resource_id=str(vital_id),
        payload={"patient_id": patient_id},
    )
