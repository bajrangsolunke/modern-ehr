from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, status

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
from app.schemas.form_request import FormRequestCreate
from app.schemas.patient_auth import PortalInviteOut
from app.services.form_request_service import FormRequestService
from app.services.patient_auth_service import PatientAuthService
from app.services.patient_service import PatientService
from app.services import email_service
from app.email import templates

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
    # Non-admins (provider / staff) only see their own caseload.
    # Overriding the client-provided physician_id here means a provider
    # can't escalate the view by passing someone else's UUID. Admins
    # keep the full list and the manual physician_id filter still pivots.
    if current.role != UserRole.admin:
        physician_id = current.id

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

    # Auto-create the intake form so onboarding always has a starting
    # point on the workqueue. The form is in "pending" state — staff
    # (or the patient via a future portal) fills it during the first
    # visit. A linked task is created server-side by the form service.
    try:
        intake = await FormRequestService(db).request_form(
            viewer_id=current.id,
            payload=FormRequestCreate(
                patient_id=patient.id,
                form_type="intake",
                notes="Auto-generated on patient creation. "
                "Capture chief complaint, current meds, allergies, history.",
            ),
        )
        await AuditService(db).record_request(
            request,
            user_id=current.id,
            action="form.request",
            resource_type="form_request",
            resource_id=str(intake.id),
            payload={"auto": True, "patient_id": str(patient.id)},
        )
    except Exception:  # noqa: BLE001 - never block patient create on this
        # The intake auto-create is a convenience; if it fails (e.g.,
        # because the forms tables aren't migrated yet in a partial
        # deploy), the patient create still succeeds.
        pass

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


@router.post(
    "/{patient_id}/portal-invite",
    response_model=PortalInviteOut,
    dependencies=[write_role_dep],
)
async def invite_to_portal(
    patient_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
    background_tasks: BackgroundTasks,
) -> PortalInviteOut:
    """Provider/admin generates a one-time setup URL the patient uses
    to set their portal password. When SMTP is configured the URL is
    also emailed to the patient automatically."""
    service = PatientAuthService(db)
    url, expires = await service.issue_invite(patient_id)

    # Fetch patient email for notification (already validated in service).
    from app.models.patient import Patient
    patient = await db.get(Patient, patient_id)
    patient_email = patient.email if patient else None
    patient_name = f"{patient.first_name} {patient.last_name}" if patient else "Patient"

    email_queued = False
    if patient_email:
        subject, html, text = templates.patient_invite(
            patient_name=patient_name,
            setup_url=url,
            expires_at=expires,
        )
        background_tasks.add_task(
            email_service.send_email,
            to=patient_email,
            subject=subject,
            html=html,
            text=text,
        )
        email_queued = email_service._is_configured()

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="patient.invite",
        resource_type="patient",
        resource_id=str(patient_id),
    )
    return PortalInviteOut(setup_url=url, expires_at=expires, email_queued=email_queued)
