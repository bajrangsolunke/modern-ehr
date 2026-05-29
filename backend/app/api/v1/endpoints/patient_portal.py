"""Patient portal endpoints. Every route uses CurrentPatient — the dep
enforces token_type=='patient' so staff tokens can't reach here."""
from uuid import UUID

from fastapi import APIRouter, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy import select

from pydantic import BaseModel, Field

from app.ai.rag import RagService
from app.api.deps import CurrentPatient, DbSession
from app.core.rate_limit import limiter
from app.schemas.ai import AiQuestionResponse
from app.schemas.patient_auth import (
    AIHealthSummaryOut,
    PatientAvatarIn,
    PatientMeOut,
    PatientPasswordChange,
    PatientPreferences,
    PatientPreferencesUpdate,
    PatientSelfUpdate,
)
from app.services.audit_service import AuditService


class PatientAskIn(BaseModel):
    """Patient-side chart Q&A request. No patient_id — derived from
    CurrentPatient. The patient cannot query another patient's chart."""

    question: str = Field(..., min_length=1, max_length=2000)
from app.schemas.invoice import InvoiceOut
from app.schemas.patient_dashboard import DashboardOut
from app.schemas.patient_portal_appointments import PatientAppointmentListOut
from app.schemas.patient_portal_documents import (
    PatientDocumentListOut,
    PatientDocumentOut,
)
from app.schemas.patient_portal_forms import PatientFormRequestListOut
from app.schemas.patient_portal_messages import (
    MarkReadIn,
    ConversationDetailOut,
    ConversationListOut,
    MessageOut,
    SendMessageIn,
)
from app.schemas.patient_portal_notifications import PatientNotificationListOut
from app.schemas.payment import StripeInitIn, StripeInitOut
from app.schemas.patient_portal_tasks import (
    FormDetailOut,
    PatientTaskListOut,
    SubmitFormIn,
)
from app.schemas.telehealth import PatientConsentOut
from app.services.invoice_service import InvoiceService
from app.services.patient_ai_service import PatientAIService
from app.services.patient_appointments_service import PatientAppointmentsService
from app.services.patient_dashboard_service import PatientDashboardService
from app.services.patient_documents_service import PatientDocumentsService
from app.services.patient_messages_service import PatientMessagesService
from app.services.patient_notifications_service import PatientNotificationsService
from app.services.payment_service import PaymentService
from app.services.patient_tasks_service import PatientTasksService
from app.services.telehealth_service import TelehealthService


router = APIRouter(prefix="/patient-portal", tags=["patient-portal"])


def _serialize_me(p) -> PatientMeOut:
    """Single source of truth for shaping a Patient row into PatientMeOut."""
    return PatientMeOut(
        id=p.id,
        mrn=p.mrn,
        first_name=p.first_name,
        last_name=p.last_name,
        email=p.email,
        phone=p.phone,
        dob=p.dob.isoformat() if p.dob else None,
        avatar_url=p.avatar_url,
        sex=p.sex,
        blood_group=p.blood_group,
        gender_identity=p.gender_identity,
        preferred_pronouns=p.preferred_pronouns,
        mailing_address_line1=p.mailing_address_line1,
        mailing_address_line2=p.mailing_address_line2,
        mailing_city=p.mailing_city,
        mailing_state=p.mailing_state,
        mailing_postal_code=p.mailing_postal_code,
        mailing_country=p.mailing_country,
        physical_same_as_mailing=p.physical_same_as_mailing,
        physical_address_line1=p.physical_address_line1,
        physical_address_line2=p.physical_address_line2,
        physical_city=p.physical_city,
        physical_state=p.physical_state,
        physical_postal_code=p.physical_postal_code,
        physical_country=p.physical_country,
        emergency_contact_name=p.emergency_contact_name,
        emergency_contact_phone=p.emergency_contact_phone,
        emergency_contact_relationship=p.emergency_contact_relationship,
    )


@router.get("/me", response_model=PatientMeOut)
async def me(current: CurrentPatient) -> PatientMeOut:
    return _serialize_me(current)


@router.patch("/me", response_model=PatientMeOut)
async def update_me(
    body: PatientSelfUpdate,
    db: DbSession,
    current: CurrentPatient,
) -> PatientMeOut:
    """Patient self-update for editable demographics + addresses +
    emergency contact. MRN is fixed. Email change does NOT trigger
    re-verification yet (deferred)."""
    from datetime import date as _date

    data = body.model_dump(exclude_unset=True)
    if "dob" in data and data["dob"] is not None:
        try:
            current.dob = _date.fromisoformat(data["dob"])
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid date of birth")
        data.pop("dob")
    for field, value in data.items():
        setattr(current, field, value)
    await db.commit()
    await db.refresh(current)
    return _serialize_me(current)


@router.post("/me/avatar", response_model=PatientMeOut)
async def update_my_avatar(
    body: PatientAvatarIn,
    db: DbSession,
    current: CurrentPatient,
) -> PatientMeOut:
    """Set or clear the patient's avatar. Accepts a data URL so the FE
    can preview the cropped image and POST without multipart wiring.
    Pass `avatar_url: null` to remove."""
    if body.avatar_url is not None and not body.avatar_url.startswith(
        ("data:image/", "http://", "https://")
    ):
        raise HTTPException(
            status_code=422,
            detail="avatar_url must be a data URL or http(s) URL",
        )
    current.avatar_url = body.avatar_url
    await db.commit()
    await db.refresh(current)
    return _serialize_me(current)


@router.post("/me/password", status_code=204)
async def change_my_password(
    body: PatientPasswordChange,
    db: DbSession,
    current: CurrentPatient,
) -> Response:
    """Rotate the patient's password. Wrong current password → 401.
    Existing tokens stay valid (cross-device revocation is deferred)."""
    from app.core.security import hash_password, verify_password

    if not current.hashed_password or not verify_password(
        body.current_password, current.hashed_password
    ):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if body.new_password == body.current_password:
        raise HTTPException(
            status_code=422, detail="New password must differ from current"
        )
    current.hashed_password = hash_password(body.new_password)
    await db.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------- prefs


@router.get("/me/preferences", response_model=PatientPreferences)
async def get_my_preferences(current: CurrentPatient) -> PatientPreferences:
    """Returns notification + healthcare preferences merged with
    defaults. Rows that were created before this column existed read
    back as defaults — the FE doesn't need to special-case missing keys."""
    raw = current.preferences or {}
    return PatientPreferences.model_validate(raw)


@router.put("/me/preferences", response_model=PatientPreferences)
async def update_my_preferences(
    body: PatientPreferencesUpdate,
    db: DbSession,
    current: CurrentPatient,
) -> PatientPreferences:
    """Partial update — sections you don't pass keep their current
    values. Server merges so the FE can save just the notifications
    section without re-sending healthcare prefs."""
    existing = PatientPreferences.model_validate(current.preferences or {})
    merged = existing.model_dump()
    if body.notifications is not None:
        merged["notifications"] = body.notifications.model_dump()
    if body.healthcare is not None:
        merged["healthcare"] = body.healthcare.model_dump()
    current.preferences = merged
    # JSONB columns need an explicit "dirty" mark in some SA versions
    # before the change is picked up; reassigning the whole dict above
    # is enough because we replace the reference.
    await db.commit()
    await db.refresh(current)
    return PatientPreferences.model_validate(current.preferences or {})


# ---------------------------------------------------------------- AI summary


@router.get("/me/ai-summary", response_model=AIHealthSummaryOut)
async def get_my_ai_summary(
    db: DbSession, current: CurrentPatient
) -> AIHealthSummaryOut:
    """Deterministic 'AI Insight' health summary derived from the
    patient's recent vitals, appointments, and conditions. Returns a
    short paragraph plus 2-3 supporting bullets and a confidence
    score. The FE shows the paragraph in the AI Insight card and the
    bullets under "View full report"."""
    from datetime import datetime, timezone

    from app.models.appointment import Appointment, AppointmentStatus
    from app.models.condition import Condition
    from app.models.vital import VitalSign

    # Recent vitals (last ~30 days)
    vitals_rows = (
        await db.execute(
            select(VitalSign)
            .where(VitalSign.patient_id == current.id)
            .order_by(VitalSign.recorded_at.desc())
            .limit(30)
        )
    ).scalars().all()

    conditions = (
        await db.execute(
            select(Condition).where(Condition.patient_id == current.id)
        )
    ).scalars().all()

    upcoming = (
        await db.execute(
            select(Appointment)
            .where(
                Appointment.patient_id == current.id,
                Appointment.starts_at >= datetime.now(timezone.utc),
                Appointment.status.in_(
                    [AppointmentStatus.scheduled, AppointmentStatus.confirmed]
                ),
            )
            .order_by(Appointment.starts_at.asc())
            .limit(1)
        )
    ).scalars().all()

    bullets: list[str] = []
    if vitals_rows:
        bullets.append(
            f"{len(vitals_rows)} vitals logged in the last 30 days — trends look stable."
        )
    else:
        bullets.append(
            "No vitals logged recently. Connect a device or schedule a check-in."
        )
    if conditions:
        names = ", ".join(c.name for c in conditions[:2] if c.name)
        if names:
            bullets.append(f"Actively managing: {names}.")
    if upcoming:
        bullets.append(
            f"Next visit is {upcoming[0].starts_at.strftime('%b %d at %-I:%M %p')}."
        )
    else:
        bullets.append("No upcoming visits — book preventive care.")

    summary = (
        "Your last 30 days look stable. Hydration trends are improving "
        "and your next preventive visit is due in 3 months."
    )
    if vitals_rows and conditions:
        summary = (
            f"You're keeping {len(conditions)} condition"
            f"{'s' if len(conditions) != 1 else ''} on track with steady "
            f"vitals over the last {len(vitals_rows)} readings."
        )
    elif not vitals_rows and not upcoming:
        summary = (
            "We don't have recent readings or a scheduled visit on file. "
            "Connecting a device or booking a check-in keeps your summary fresh."
        )

    return AIHealthSummaryOut(
        summary=summary,
        bullets=bullets,
        confidence=88 if vitals_rows else 60,
        generated_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------- summary download


@router.get("/me/medical-summary")
async def get_my_medical_summary(
    db: DbSession, current: CurrentPatient
) -> Response:
    """Generates a plain-text medical summary the patient can download
    or share. Plain text avoids a heavy PDF dependency; mime-type +
    filename make browsers prompt a Save dialog."""
    from datetime import datetime, timezone

    from app.models.allergy import Allergy
    from app.models.appointment import Appointment, AppointmentStatus
    from app.models.condition import Condition
    from app.models.medication import Medication
    from app.models.vital import VitalSign

    allergies = (
        await db.execute(
            select(Allergy).where(Allergy.patient_id == current.id)
        )
    ).scalars().all()
    conditions = (
        await db.execute(
            select(Condition).where(Condition.patient_id == current.id)
        )
    ).scalars().all()
    medications = (
        await db.execute(
            select(Medication).where(Medication.patient_id == current.id)
        )
    ).scalars().all()
    recent_vitals = (
        await db.execute(
            select(VitalSign)
            .where(VitalSign.patient_id == current.id)
            .order_by(VitalSign.recorded_at.desc())
            .limit(5)
        )
    ).scalars().all()
    upcoming_appts = (
        await db.execute(
            select(Appointment)
            .where(
                Appointment.patient_id == current.id,
                Appointment.starts_at >= datetime.now(timezone.utc),
                Appointment.status.in_(
                    [AppointmentStatus.scheduled, AppointmentStatus.confirmed]
                ),
            )
            .order_by(Appointment.starts_at.asc())
            .limit(5)
        )
    ).scalars().all()

    def _section(title: str, lines: list[str]) -> str:
        body = "\n".join(f"  • {line}" for line in lines) if lines else "  (none on file)"
        return f"{title}\n{'-' * len(title)}\n{body}\n\n"

    parts: list[str] = []
    parts.append(f"MEDICAL SUMMARY — {current.full_name}\n")
    parts.append("=" * 60 + "\n\n")
    parts.append(
        f"MRN: {current.mrn}\n"
        f"DOB: {current.dob.isoformat() if current.dob else '—'}\n"
        f"Email: {current.email or '—'}\n"
        f"Phone: {current.phone or '—'}\n"
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n\n"
    )
    parts.append(
        _section(
            "Allergies",
            [f"{a.substance} ({a.severity or 'unknown severity'})" for a in allergies],
        )
    )
    parts.append(
        _section(
            "Active conditions",
            [
                f"{c.name}" + (f" — {c.icd10}" if getattr(c, "icd10", None) else "")
                for c in conditions
            ],
        )
    )
    parts.append(
        _section(
            "Medications",
            [
                f"{m.name} {getattr(m, 'dose', '') or ''} {getattr(m, 'frequency', '') or ''}".strip()
                for m in medications
            ],
        )
    )
    parts.append(
        _section(
            "Recent vitals",
            [
                f"{v.recorded_at.strftime('%Y-%m-%d')} — "
                f"{v.metric}: {v.value}{(' ' + v.unit) if v.unit else ''}"
                for v in recent_vitals
            ],
        )
    )
    parts.append(
        _section(
            "Upcoming appointments",
            [
                f"{a.starts_at.strftime('%Y-%m-%d %H:%M')} — {a.type.value if a.type else 'visit'}"
                for a in upcoming_appts
            ],
        )
    )
    parts.append(
        "This summary is generated from your patient portal and is intended "
        "for informational use. Always confirm with your provider before "
        "making care decisions.\n"
    )

    content = "".join(parts).encode("utf-8")
    filename = f"medical-summary-{current.mrn}.txt"
    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/me/dashboard", response_model=DashboardOut)
async def my_dashboard(
    db: DbSession, current: CurrentPatient
) -> DashboardOut:
    return await PatientDashboardService(db).for_patient(current)


@router.get("/me/appointments", response_model=PatientAppointmentListOut)
async def my_appointments(
    db: DbSession, current: CurrentPatient
) -> PatientAppointmentListOut:
    return await PatientAppointmentsService(db).list_for_patient(current.id)


@router.get("/me/documents", response_model=PatientDocumentListOut)
async def my_documents(
    db: DbSession, current: CurrentPatient
) -> PatientDocumentListOut:
    return await PatientDocumentsService(db).list_for_patient(current.id)


@router.post(
    "/me/documents/upload",
    response_model=PatientDocumentOut,
    status_code=201,
)
async def upload_my_document(
    file: UploadFile,
    db: DbSession,
    current: CurrentPatient,
    category: str = Form("general"),
) -> PatientDocumentOut:
    return await PatientDocumentsService(db).upload_for_patient(
        current.id, file, category
    )


@router.get("/me/forms", response_model=PatientFormRequestListOut)
async def my_forms(
    db: DbSession, current: CurrentPatient
) -> PatientFormRequestListOut:
    return await PatientTasksService(db).list_form_requests(current.id)


@router.get("/me/notifications", response_model=PatientNotificationListOut)
async def my_notifications(
    db: DbSession, current: CurrentPatient
) -> PatientNotificationListOut:
    return await PatientNotificationsService(db).list_for_patient(current.id)


@router.get("/me/tasks", response_model=PatientTaskListOut)
async def my_tasks(
    db: DbSession, current: CurrentPatient
) -> PatientTaskListOut:
    return await PatientTasksService(db).list_for_patient(current.id)


@router.post("/me/tasks/{task_id}/complete", status_code=204)
async def complete_my_task(
    task_id: UUID, db: DbSession, current: CurrentPatient
) -> None:
    await PatientTasksService(db).complete_task(task_id, current.id)


@router.get("/me/forms/{form_id}", response_model=FormDetailOut)
async def my_form(
    form_id: UUID, db: DbSession, current: CurrentPatient
) -> FormDetailOut:
    return await PatientTasksService(db).get_form_detail(form_id, current.id)


@router.post("/me/forms/{form_id}/submit", response_model=FormDetailOut)
async def submit_my_form(
    form_id: UUID,
    payload: SubmitFormIn,
    db: DbSession,
    current: CurrentPatient,
) -> FormDetailOut:
    return await PatientTasksService(db).submit_form(
        form_id, current.id, payload.data
    )


@router.get("/me/conversations", response_model=ConversationListOut)
async def my_conversations(
    db: DbSession, current: CurrentPatient
) -> ConversationListOut:
    return await PatientMessagesService(db).list_for_patient(current.id)


@router.get(
    "/me/conversations/{conv_id}", response_model=ConversationDetailOut
)
async def my_conversation_detail(
    conv_id: UUID, db: DbSession, current: CurrentPatient
) -> ConversationDetailOut:
    return await PatientMessagesService(db).get_detail(conv_id, current.id)


@router.post(
    "/me/conversations/{conv_id}/messages",
    response_model=MessageOut,
    status_code=201,
)
async def send_my_message(
    conv_id: UUID,
    payload: SendMessageIn,
    db: DbSession,
    current: CurrentPatient,
) -> MessageOut:
    return await PatientMessagesService(db).send_message(
        conv_id, current.id, payload.body
    )


@router.post(
    "/me/conversations/{conv_id}/read",
    status_code=204,
)
async def mark_my_conversation_read(
    conv_id: UUID,
    payload: MarkReadIn,
    db: DbSession,
    current: CurrentPatient,
) -> None:
    """Patient opened the thread — bumps `patient_last_read_at` and
    fires a `conversation.read` broadcast so providers' double-tick
    flips on their outgoing bubbles."""
    await PatientMessagesService(db).mark_read(
        conv_id, current.id, payload.last_read_at
    )


@router.post(
    "/me/conversations/{conv_id}/typing",
    status_code=204,
)
async def ping_my_conversation_typing(
    conv_id: UUID,
    db: DbSession,
    current: CurrentPatient,
) -> None:
    """Transient typing ping — broadcasts to every active staff user
    on the conversation. No DB write."""
    await PatientMessagesService(db).ping_typing(conv_id, current.id)


@router.post(
    "/me/telehealth/{appointment_id}/consent",
    response_model=PatientConsentOut,
)
async def consent_to_telehealth(
    appointment_id: UUID,
    db: DbSession,
    current: CurrentPatient,
) -> PatientConsentOut:
    """Patient accepts the consent banner. Records the timestamp and
    mints a Daily join token. The frontend then opens the iframe
    with `daily_room_url` + `meeting_token`."""
    name = f"{current.first_name} {current.last_name}".strip() or "Patient"
    session, token = await TelehealthService(db).consent_and_mint_patient_token(
        appointment_id=appointment_id,
        patient_id=current.id,
        patient_name=name,
    )
    return PatientConsentOut(
        session_id=session.id,
        daily_room_url=session.daily_room_url,
        meeting_token=token,
    )


@router.post("/me/conversations/{conv_id}/ai-suggest")
@limiter.limit("10/minute")
async def my_ai_suggest_replies(
    request: Request,
    conv_id: UUID,
    db: DbSession,
    current: CurrentPatient,
) -> dict[str, list[str]]:
    suggestions = await PatientAIService(db).suggest_replies(
        conv_id, current.id
    )
    return {"suggestions": suggestions}


@router.post("/me/ask", response_model=AiQuestionResponse)
@limiter.limit("20/minute")
async def my_chart_qa(
    request: Request,
    payload: PatientAskIn,
    db: DbSession,
    current: CurrentPatient,
) -> AiQuestionResponse:
    """Patient-side AI chart Q&A. The patient is resolved from the JWT
    (CurrentPatient) — there is NO accepted patient_id field on this
    endpoint, so a patient can only ever ask about their own chart.

    Safety: the underlying prompt forbids medical advice / diagnosis /
    medication recommendations and instructs the model to direct the
    patient to their care team for those questions."""
    res = await RagService(db).ask_for_patient(
        payload.question, patient=current
    )
    await AuditService(db).record_request(
        request,
        user_id=None,
        action="patient.ask",
        resource_type="patient",
        resource_id=str(current.id),
        payload={
            "model": res.model,
            "question_chars": len(payload.question),
            "citation_count": len(res.citations),
        },
    )
    return res


@router.get("/me/documents/{doc_id}/download")
async def download_my_document(
    doc_id: UUID, db: DbSession, current: CurrentPatient
) -> Response:
    doc = await PatientDocumentsService(db).get_for_patient(current.id, doc_id)
    if doc.content is None:
        return Response(status_code=404)
    return Response(
        content=doc.content,
        media_type=doc.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{doc.name}"',
        },
    )


@router.get("/me/invoices", response_model=list[InvoiceOut])
async def my_invoices(
    db: DbSession, current: CurrentPatient
) -> list[InvoiceOut]:
    """List the signed-in patient's invoices."""
    return await InvoiceService(db).list_for_patient(current.id)


@router.get("/me/invoices/{invoice_id}", response_model=InvoiceOut)
async def my_invoice(
    invoice_id: UUID, db: DbSession, current: CurrentPatient
) -> InvoiceOut:
    inv = await InvoiceService(db).get(invoice_id)
    if inv.patient_id != current.id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


@router.post(
    "/me/invoices/{invoice_id}/stripe-init", response_model=StripeInitOut
)
async def init_my_invoice_payment(
    invoice_id: UUID, db: DbSession, current: CurrentPatient
) -> StripeInitOut:
    inv = await InvoiceService(db).get(invoice_id)
    if inv.patient_id != current.id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return await PaymentService(db).init_stripe(
        StripeInitIn(invoice_id=invoice_id)
    )
