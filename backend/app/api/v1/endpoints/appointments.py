from datetime import datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentStats,
    AppointmentUpdate,
)
from app.services.audit_service import AuditService

# Staff, providers, and admins can write. Patients/readers stay open
# to any signed-in user.
write_dep = Depends(
    require_roles(
        UserRole.staff,
        UserRole.provider,
        UserRole.admin,
    )
)
admin_only = Depends(require_roles(UserRole.admin))

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _eager() -> list:
    """Eager-load patient + physician so AppointmentOut can flatten names."""
    return [
        selectinload(Appointment.patient),
        selectinload(Appointment.physician),
    ]


@router.get("", response_model=list[AppointmentOut])
async def list_appointments(
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth check
    q: str | None = Query(None, description="Search patient name or MRN"),
    status_: AppointmentStatus | None = Query(None, alias="status"),
    type_: AppointmentType | None = Query(None, alias="type"),
    physician_id: UUID | None = None,
    patient_id: UUID | None = None,
    start_date: datetime | None = Query(None, description="Inclusive lower bound"),
    end_date: datetime | None = Query(None, description="Exclusive upper bound"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    limit: int = Query(200, ge=1, le=500),
) -> list[AppointmentOut]:
    stmt = select(Appointment).options(*_eager())

    if status_:
        stmt = stmt.where(Appointment.status == status_)
    if type_:
        stmt = stmt.where(Appointment.type == type_)
    if physician_id is not None:
        stmt = stmt.where(Appointment.physician_id == physician_id)
    if patient_id is not None:
        stmt = stmt.where(Appointment.patient_id == patient_id)
    if start_date is not None:
        stmt = stmt.where(Appointment.starts_at >= start_date)
    if end_date is not None:
        stmt = stmt.where(Appointment.starts_at < end_date)
    if q:
        needle = f"%{q.strip()}%"
        stmt = stmt.join(Patient, Appointment.patient_id == Patient.id).where(
            or_(
                Patient.first_name.ilike(needle),
                Patient.last_name.ilike(needle),
                Patient.mrn.ilike(needle),
            )
        )

    order = (
        Appointment.starts_at.asc() if sort_dir == "asc" else Appointment.starts_at.desc()
    )
    stmt = stmt.order_by(order).limit(limit)

    items = (await db.execute(stmt)).scalars().unique().all()
    return [AppointmentOut.model_validate(a) for a in items]


@router.get("/stats", response_model=AppointmentStats)
async def appointment_stats(
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
    physician_id: UUID | None = Query(
        None, description="Scope stats to one physician (defaults to all)"
    ),
) -> AppointmentStats:
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
    today_end = today_start + timedelta(days=1)
    # ISO week starting Monday.
    week_start = today_start - timedelta(days=today_start.weekday())
    week_end = week_start + timedelta(days=7)

    def base():
        s = select(func.count(Appointment.id))
        if physician_id is not None:
            s = s.where(Appointment.physician_id == physician_id)
        return s

    today = (
        await db.execute(
            base().where(
                Appointment.starts_at >= today_start,
                Appointment.starts_at < today_end,
                Appointment.status != AppointmentStatus.cancelled,
            )
        )
    ).scalar_one()
    this_week = (
        await db.execute(
            base().where(
                Appointment.starts_at >= week_start,
                Appointment.starts_at < week_end,
                Appointment.status != AppointmentStatus.cancelled,
            )
        )
    ).scalar_one()
    cancelled = (
        await db.execute(
            base().where(
                Appointment.starts_at >= week_start,
                Appointment.starts_at < week_end,
                Appointment.status == AppointmentStatus.cancelled,
            )
        )
    ).scalar_one()
    no_shows = (
        await db.execute(
            base().where(
                Appointment.starts_at >= week_start,
                Appointment.starts_at < week_end,
                Appointment.status == AppointmentStatus.no_show,
            )
        )
    ).scalar_one()

    return AppointmentStats(
        today=today,
        this_week=this_week,
        cancellations_this_week=cancelled,
        no_shows_this_week=no_shows,
    )


@router.get("/patient/{patient_id}", response_model=list[AppointmentOut])
async def for_patient(
    patient_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> list[AppointmentOut]:
    items = (
        await db.execute(
            select(Appointment)
            .options(*_eager())
            .where(Appointment.patient_id == patient_id)
            .order_by(Appointment.starts_at.desc())
        )
    ).scalars().unique().all()
    return [AppointmentOut.model_validate(a) for a in items]


@router.get("/{appt_id}", response_model=AppointmentOut)
async def get_appointment(
    appt_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> AppointmentOut:
    appt = (
        await db.execute(
            select(Appointment).options(*_eager()).where(Appointment.id == appt_id)
        )
    ).scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return AppointmentOut.model_validate(appt)


@router.post(
    "",
    response_model=AppointmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[write_dep],
)
async def create_appointment(
    payload: AppointmentCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> AppointmentOut:
    # Make sure the FKs resolve so we don't 500 on a typo.
    if not await db.get(Patient, payload.patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    if payload.physician_id and not await db.get(User, payload.physician_id):
        raise HTTPException(status_code=404, detail="Physician not found")

    appt = Appointment(**payload.model_dump())
    db.add(appt)
    await db.flush()
    # Re-fetch with eager loads so the response can include names.
    appt = (
        await db.execute(
            select(Appointment).options(*_eager()).where(Appointment.id == appt.id)
        )
    ).scalar_one()

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="appointment.create",
        resource_type="appointment",
        resource_id=str(appt.id),
        payload={
            "patient_id": str(appt.patient_id),
            "physician_id": str(appt.physician_id) if appt.physician_id else None,
            "starts_at": appt.starts_at.isoformat(),
            "status": appt.status.value,
        },
    )
    return AppointmentOut.model_validate(appt)


@router.patch(
    "/{appt_id}",
    response_model=AppointmentOut,
    dependencies=[write_dep],
)
async def update_appointment(
    appt_id: UUID,
    payload: AppointmentUpdate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> AppointmentOut:
    appt = await db.get(Appointment, appt_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    changes = payload.model_dump(exclude_unset=True)
    if "physician_id" in changes and changes["physician_id"] is not None:
        if not await db.get(User, changes["physician_id"]):
            raise HTTPException(status_code=404, detail="Physician not found")
    for k, v in changes.items():
        setattr(appt, k, v)
    await db.flush()

    appt = (
        await db.execute(
            select(Appointment).options(*_eager()).where(Appointment.id == appt.id)
        )
    ).scalar_one()

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="appointment.update",
        resource_type="appointment",
        resource_id=str(appt.id),
        payload=changes,
    )
    return AppointmentOut.model_validate(appt)


@router.delete(
    "/{appt_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[admin_only],
)
async def delete_appointment(
    appt_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    """Hard delete — admin only. Everyone else cancels via status update."""
    appt = await db.get(Appointment, appt_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    await db.delete(appt)
    await db.flush()
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="appointment.delete",
        resource_type="appointment",
        resource_id=str(appt_id),
    )
