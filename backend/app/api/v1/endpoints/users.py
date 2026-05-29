from datetime import datetime, timezone
from math import ceil
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select

from app.api.deps import CurrentUser, DbSession, require_roles
from app.core.crypto import encrypt_field
from app.core.security import hash_password
from app.models.appointment import Appointment, AppointmentStatus
from app.models.patient import Patient
from app.models.provider_education import ProviderEducation
from app.models.provider_license import ProviderLicense
from app.models.user import User, UserRole
from app.schemas.appointment import AppointmentOut
from app.schemas.common import Page
from app.schemas.user import (
    ProviderEducationIn,
    ProviderEducationOut,
    ProviderLicenseIn,
    ProviderLicenseOut,
    UserCreate,
    UserInviteResponse,
    UserOut,
    UserUpdate,
)
from app.services import email_service
from app.email import templates
from app.services.user_invite_service import UserInviteService
from app.services.audit_service import AuditService

# User management is admin-only across the board.
admin_only = Depends(require_roles(UserRole.admin))

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/assignable", response_model=Page[UserOut])
async def list_assignable_users(
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — any active staff user
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    q: str | None = Query(None, description="Search name or email"),
    role: UserRole | None = Query(
        None,
        description='Optional role filter — e.g. "provider" for an appointment provider picker.',
    ),
) -> Page[UserOut]:
    """Lightweight assignee picker used by the task drawer and other
    "assign to someone" flows. Open to any active staff user — not
    admin-only, because providers + staff need to assign tasks to
    each other. Always filters to is_active=True so deactivated
    accounts never show up as candidates."""
    stmt = select(User).where(User.is_active.is_(True))
    count_stmt = select(func.count(User.id)).where(User.is_active.is_(True))

    if q:
        needle = f"%{q.strip()}%"
        cond = or_(User.full_name.ilike(needle), User.email.ilike(needle))
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if role is not None:
        stmt = stmt.where(User.role == role)
        count_stmt = count_stmt.where(User.role == role)

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = (
        stmt.order_by(User.full_name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(stmt)).scalars().all()
    return Page[UserOut](
        items=[UserOut.model_validate(u) for u in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 1,
    )


@router.get(
    "",
    response_model=Page[UserOut],
    dependencies=[admin_only],
)
async def list_users(
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth check
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, description="Search name or email"),
    role: UserRole | None = None,
    is_active: bool | None = None,
) -> Page[UserOut]:
    stmt = select(User)
    count_stmt = select(func.count(User.id))

    if q:
        needle = f"%{q.strip()}%"
        cond = or_(User.full_name.ilike(needle), User.email.ilike(needle))
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if role is not None:
        stmt = stmt.where(User.role == role)
        count_stmt = count_stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))
        count_stmt = count_stmt.where(User.is_active.is_(is_active))

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = (
        stmt.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(stmt)).scalars().all()
    return Page[UserOut](
        items=[UserOut.model_validate(u) for u in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 1,
    )


@router.post(
    "",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[admin_only],
)
async def create_user(
    payload: UserCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> UserOut:
    existing = (
        await db.execute(select(User).where(User.email == payload.email))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    user_kwargs = payload.model_dump(
        exclude={"password", "ssn", "federal_tax_id", "education", "licenses"}
    )
    user = User(
        **user_kwargs,
        hashed_password=hash_password(payload.password) if payload.password else None,
        ssn_encrypted=encrypt_field(payload.ssn),
        federal_tax_id_encrypted=encrypt_field(payload.federal_tax_id),
    )
    db.add(user)
    await db.flush()

    now = datetime.now(timezone.utc)
    for ed in payload.education:
        db.add(
            ProviderEducation(
                user_id=user.id,
                created_at=now,
                **ed.model_dump(),
            )
        )
    for lic in payload.licenses:
        db.add(
            ProviderLicense(
                user_id=user.id,
                created_at=now,
                **lic.model_dump(),
            )
        )
    await db.flush()
    await db.refresh(user, attribute_names=["education", "licenses"])

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="user.create",
        resource_type="user",
        resource_id=str(user.id),
        payload={
            "email": user.email,
            "role": user.role.value,
            "has_ssn": payload.ssn is not None,
            "has_tax_id": payload.federal_tax_id is not None,
            "education_count": len(payload.education),
            "license_count": len(payload.licenses),
        },
    )
    return UserOut.model_validate(user)


@router.get(
    "/{user_id}",
    response_model=UserOut,
    dependencies=[admin_only],
)
async def get_user(
    user_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> UserOut:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.patch(
    "/{user_id}",
    response_model=UserOut,
    dependencies=[admin_only],
)
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> UserOut:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Refuse to lock yourself out of admin.
    if user.id == current.id and payload.role is not None and payload.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can't demote yourself from admin",
        )
    if user.id == current.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can't deactivate your own account",
        )

    changes = payload.model_dump(exclude_unset=True)
    new_password = changes.pop("password", None)

    for k, v in changes.items():
        setattr(user, k, v)
    if new_password:
        user.hashed_password = hash_password(new_password)

    await db.flush()
    await db.refresh(user)

    # Don't put the password in the audit log payload.
    audit_payload = {k: (v.value if hasattr(v, "value") else v) for k, v in changes.items()}
    if new_password:
        audit_payload["password"] = "<rotated>"
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="user.update",
        resource_type="user",
        resource_id=str(user.id),
        payload=audit_payload,
    )
    return UserOut.model_validate(user)


class UserStats(BaseModel):
    """Summary metrics for the user detail page."""

    patient_count: int
    upcoming_appointments: int
    completed_appointments: int


@router.get(
    "/{user_id}/stats",
    response_model=UserStats,
    dependencies=[admin_only],
)
async def user_stats(
    user_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> UserStats:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    patient_count = (
        await db.execute(
            select(func.count(Patient.id)).where(Patient.assigned_physician_id == user_id)
        )
    ).scalar_one()

    now = datetime.now(timezone.utc)
    upcoming = (
        await db.execute(
            select(func.count(Appointment.id)).where(
                Appointment.physician_id == user_id,
                Appointment.starts_at >= now,
                Appointment.status != AppointmentStatus.cancelled,
            )
        )
    ).scalar_one()
    completed = (
        await db.execute(
            select(func.count(Appointment.id)).where(
                Appointment.physician_id == user_id,
                Appointment.status == AppointmentStatus.completed,
            )
        )
    ).scalar_one()

    return UserStats(
        patient_count=patient_count,
        upcoming_appointments=upcoming,
        completed_appointments=completed,
    )


@router.get(
    "/{user_id}/appointments",
    response_model=list[AppointmentOut],
    dependencies=[admin_only],
)
async def user_appointments(
    user_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
    limit: int = Query(20, ge=1, le=100),
) -> list[AppointmentOut]:
    items = (
        await db.execute(
            select(Appointment)
            .where(Appointment.physician_id == user_id)
            .order_by(Appointment.starts_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [AppointmentOut.model_validate(a) for a in items]


@router.post(
    "/{user_id}/invite",
    response_model=UserInviteResponse,
    dependencies=[admin_only],
)
async def invite_user(
    user_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
    background_tasks: BackgroundTasks,
) -> UserInviteResponse:
    """Admin-only: generate a one-time setup URL for a staff user and
    optionally email it to them. The user uses the link to set their
    password and complete account setup."""
    invite_svc = UserInviteService(db)
    url, expires = await invite_svc.issue_invite(user_id)

    # Load user for email / display info.
    user = await db.get(User, user_id)
    email_queued = False
    if user and user.email:
        subject, html, text = templates.user_invite(
            full_name=user.full_name,
            setup_url=url,
            expires_at=expires,
            role=user.role.value,
        )
        background_tasks.add_task(
            email_service.send_email,
            to=user.email,
            subject=subject,
            html=html,
            text=text,
        )
        email_queued = email_service._is_configured()

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="user.invite",
        resource_type="user",
        resource_id=str(user_id),
    )
    return UserInviteResponse(setup_url=url, expires_at=expires, email_queued=email_queued)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[admin_only],
)
async def deactivate_user(
    user_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    """
    Soft-delete: flip is_active=false so audit trails stay intact.
    Returning 204 keeps the row in place.
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can't deactivate your own account",
        )
    if not user.is_active:
        # Idempotent — already deactivated.
        return None
    user.is_active = False
    await db.flush()
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="user.deactivate",
        resource_type="user",
        resource_id=str(user.id),
        payload={"email": user.email},
    )


# --- Provider education sub-rows ------------------------------------

@router.get(
    "/{user_id}/education",
    response_model=list[ProviderEducationOut],
)
async def list_user_education(
    user_id: UUID, db: DbSession, _current: CurrentUser
) -> list[ProviderEducationOut]:
    rows = (
        await db.execute(
            select(ProviderEducation).where(ProviderEducation.user_id == user_id)
        )
    ).scalars().all()
    return [ProviderEducationOut.model_validate(r) for r in rows]


@router.post(
    "/{user_id}/education",
    response_model=ProviderEducationOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[admin_only],
)
async def add_user_education(
    user_id: UUID,
    payload: ProviderEducationIn,
    db: DbSession,
    _current: CurrentUser,
) -> ProviderEducationOut:
    if not await db.get(User, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    row = ProviderEducation(
        user_id=user_id,
        created_at=datetime.now(timezone.utc),
        **payload.model_dump(),
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return ProviderEducationOut.model_validate(row)


@router.delete(
    "/education/{education_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[admin_only],
)
async def delete_user_education(
    education_id: UUID, db: DbSession, _current: CurrentUser
) -> None:
    row = await db.get(ProviderEducation, education_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Education record not found")
    await db.delete(row)
    await db.flush()


# --- Provider licenses sub-rows -------------------------------------

@router.get(
    "/{user_id}/licenses",
    response_model=list[ProviderLicenseOut],
)
async def list_user_licenses(
    user_id: UUID, db: DbSession, _current: CurrentUser
) -> list[ProviderLicenseOut]:
    rows = (
        await db.execute(
            select(ProviderLicense).where(ProviderLicense.user_id == user_id)
        )
    ).scalars().all()
    return [ProviderLicenseOut.model_validate(r) for r in rows]


@router.post(
    "/{user_id}/licenses",
    response_model=ProviderLicenseOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[admin_only],
)
async def add_user_license(
    user_id: UUID,
    payload: ProviderLicenseIn,
    db: DbSession,
    _current: CurrentUser,
) -> ProviderLicenseOut:
    if not await db.get(User, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    row = ProviderLicense(
        user_id=user_id,
        created_at=datetime.now(timezone.utc),
        **payload.model_dump(),
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return ProviderLicenseOut.model_validate(row)


@router.delete(
    "/licenses/{license_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[admin_only],
)
async def delete_user_license(
    license_id: UUID, db: DbSession, _current: CurrentUser
) -> None:
    row = await db.get(ProviderLicense, license_id)
    if row is None:
        raise HTTPException(status_code=404, detail="License record not found")
    await db.delete(row)
    await db.flush()
