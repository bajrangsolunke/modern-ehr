from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.alert import PatientAlert
from app.models.user import UserRole
from app.schemas.alert import AlertCreate, AlertOut, AlertUpdate
from app.services.audit_service import AuditService

# Alerts can be flagged or cleared by any provider, plus admins.
alert_writer = Depends(
    require_roles(
        UserRole.provider,
        UserRole.admin,
    )
)

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/patient/{patient_id}", response_model=list[AlertOut])
async def list_for_patient(
    patient_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth check
    include_resolved: bool = Query(False),
) -> list[AlertOut]:
    stmt = select(PatientAlert).where(PatientAlert.patient_id == patient_id)
    if not include_resolved:
        stmt = stmt.where(PatientAlert.resolved.is_(False))
    # Severity ordering: critical first; ties broken by recency.
    stmt = stmt.order_by(
        PatientAlert.severity.asc(),
        PatientAlert.created_at.desc(),
    )
    result = await db.execute(stmt)
    return [AlertOut.model_validate(a) for a in result.scalars().all()]


@router.post(
    "",
    response_model=AlertOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[alert_writer],
)
async def create_alert(
    payload: AlertCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> AlertOut:
    alert = PatientAlert(**payload.model_dump(), created_by_id=current.id)
    db.add(alert)
    await db.flush()
    await db.refresh(alert)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="alert.create",
        resource_type="patient_alert",
        resource_id=str(alert.id),
        payload={
            "patient_id": str(alert.patient_id),
            "severity": alert.severity.value,
            "label": alert.label,
        },
    )
    return AlertOut.model_validate(alert)


@router.patch(
    "/{alert_id}",
    response_model=AlertOut,
    dependencies=[alert_writer],
)
async def update_alert(
    alert_id: UUID,
    payload: AlertUpdate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> AlertOut:
    alert = await db.get(PatientAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(alert, k, v)
    await db.flush()
    await db.refresh(alert)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="alert.update",
        resource_type="patient_alert",
        resource_id=str(alert.id),
        payload={k: (v.value if hasattr(v, "value") else v) for k, v in changes.items()},
    )
    return AlertOut.model_validate(alert)


@router.delete(
    "/{alert_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[alert_writer],
)
async def delete_alert(
    alert_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    alert = await db.get(PatientAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    patient_id = str(alert.patient_id)
    await db.delete(alert)
    await db.flush()
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="alert.delete",
        resource_type="patient_alert",
        resource_id=str(alert_id),
        payload={"patient_id": patient_id},
    )
