from collections import defaultdict
from datetime import date as date_t, datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.availability import UserAvailability
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentStats,
    AppointmentUpdate,
    attach_billing,
)
from app.services.appointment_service import AppointmentService
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


class SlotOut(BaseModel):
    """A bookable window on a provider's day."""

    physician_id: UUID
    physician_name: str
    starts_at: datetime
    duration_minutes: int
    # Existing appts on this provider for the same day — the FE
    # surfaces it as "Light/Busy/Heavy" so the user can spread load.
    load: int = 0


@router.get("/slots", response_model=list[SlotOut])
async def list_slots(
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth check
    date: date_t = Query(..., description="Day to find available slots for"),
    duration: int = Query(30, ge=5, le=480, description="Slot length in minutes"),
    physician_id: UUID | None = Query(
        None, description="Scope to one provider; omit for round-robin across all"
    ),
) -> list[SlotOut]:
    """
    Derive bookable slots from provider weekly availability minus already-
    booked (non-cancelled) appointments. When no physician_id is set we
    return slots across every active provider, sorted by time then by
    each provider's day-load — so the FE shows the least-busy provider
    first (round-robin distribution).
    """
    weekday = date.weekday()  # 0=Mon..6=Sun

    avail_stmt = (
        select(UserAvailability)
        .options(selectinload(UserAvailability.user))
        .join(User, UserAvailability.user_id == User.id)
        .where(
            UserAvailability.day_of_week == weekday,
            UserAvailability.is_active.is_(True),
            User.is_active.is_(True),
        )
    )
    if physician_id:
        avail_stmt = avail_stmt.where(UserAvailability.user_id == physician_id)
    else:
        avail_stmt = avail_stmt.where(User.role == UserRole.provider)
    avails = (await db.execute(avail_stmt)).scalars().unique().all()

    if not avails:
        return []

    day_start = datetime.combine(date, time.min, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    existing_stmt = select(Appointment).where(
        Appointment.starts_at >= day_start,
        Appointment.starts_at < day_end,
        Appointment.status != AppointmentStatus.cancelled,
    )
    if physician_id:
        existing_stmt = existing_stmt.where(Appointment.physician_id == physician_id)
    existing = (await db.execute(existing_stmt)).scalars().all()

    # Pre-bucket existing appts per provider for quick conflict checks.
    by_provider: dict[UUID, list[Appointment]] = defaultdict(list)
    for a in existing:
        if a.physician_id is not None:
            by_provider[a.physician_id].append(a)

    slots: list[dict] = []
    delta = timedelta(minutes=duration)
    for avail in avails:
        provider = avail.user
        if provider is None:
            continue
        window_start = datetime.combine(date, avail.start_time, tzinfo=timezone.utc)
        window_end = datetime.combine(date, avail.end_time, tzinfo=timezone.utc)
        load = len(by_provider.get(provider.id, []))

        cursor = window_start
        while cursor + delta <= window_end:
            slot_end = cursor + delta
            conflict = any(
                appt.starts_at < slot_end
                and appt.starts_at + timedelta(minutes=appt.duration_minutes) > cursor
                for appt in by_provider.get(provider.id, [])
            )
            if not conflict:
                slots.append(
                    {
                        "physician_id": provider.id,
                        "physician_name": provider.full_name,
                        "starts_at": cursor,
                        "duration_minutes": duration,
                        "load": load,
                    }
                )
            cursor = slot_end

    # Round-robin: by time first (so the UI groups naturally), then put
    # the least-loaded provider's slot first within the same time.
    slots.sort(key=lambda s: (s["starts_at"], s["load"], s["physician_name"]))
    return [SlotOut(**s) for s in slots]


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
    extras = await AppointmentService(db).load_billing_extras(appt)
    attach_billing(
        appt,
        service_code=extras[0],
        invoice_id=extras[1],
        invoice_total_cents=extras[2],
        invoice_balance_cents=extras[3],
    )
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

    svc = AppointmentService(db)
    appt = await svc.create(payload, viewer_id=current.id)

    # Re-fetch with eager loads so the response can include names.
    appt = (
        await db.execute(
            select(Appointment).options(*_eager()).where(Appointment.id == appt.id)
        )
    ).scalar_one()

    extras = await svc.load_billing_extras(appt)
    attach_billing(
        appt,
        service_code=extras[0],
        invoice_id=extras[1],
        invoice_total_cents=extras[2],
        invoice_balance_cents=extras[3],
    )

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
            "service_catalog_id": (
                str(appt.service_catalog_id)
                if appt.service_catalog_id else None
            ),
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
