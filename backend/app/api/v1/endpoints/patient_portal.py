"""Patient portal endpoints. Every route uses CurrentPatient — the dep
enforces token_type=='patient' so staff tokens can't reach here."""
from uuid import UUID

from fastapi import APIRouter, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response

from pydantic import BaseModel, Field

from app.ai.rag import RagService
from app.api.deps import CurrentPatient, DbSession
from app.core.config import settings
from app.core.rate_limit import limiter
from app.schemas.ai import AiQuestionResponse
from app.schemas.patient_auth import PatientMeOut
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


@router.get("/me", response_model=PatientMeOut)
async def me(current: CurrentPatient) -> PatientMeOut:
    return PatientMeOut(
        id=current.id,
        mrn=current.mrn,
        first_name=current.first_name,
        last_name=current.last_name,
        email=current.email,
        phone=current.phone,
        dob=current.dob.isoformat() if current.dob else None,
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
        provider=settings.VIDEO_PROVIDER,  # type: ignore[arg-type]
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
    """List the signed-in patient's invoices. CurrentPatient is the only
    auth — staff JWTs can't reach here (token_type='patient' is required)."""
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
