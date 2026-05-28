"""Patient portal endpoints. Every route uses CurrentPatient — the dep
enforces token_type=='patient' so staff tokens can't reach here."""
from uuid import UUID

from fastapi import APIRouter
from fastapi.responses import Response

from app.api.deps import CurrentPatient, DbSession
from app.schemas.patient_auth import PatientMeOut
from app.schemas.patient_dashboard import DashboardOut
from app.schemas.patient_portal_appointments import PatientAppointmentListOut
from app.schemas.patient_portal_documents import PatientDocumentListOut
from app.schemas.patient_portal_messages import (
    ConversationDetailOut,
    ConversationListOut,
    MessageOut,
    SendMessageIn,
)
from app.schemas.patient_portal_notifications import PatientNotificationListOut
from app.schemas.patient_portal_tasks import (
    FormDetailOut,
    PatientTaskListOut,
    SubmitFormIn,
)
from app.services.patient_appointments_service import PatientAppointmentsService
from app.services.patient_dashboard_service import PatientDashboardService
from app.services.patient_documents_service import PatientDocumentsService
from app.services.patient_messages_service import PatientMessagesService
from app.services.patient_notifications_service import PatientNotificationsService
from app.services.patient_tasks_service import PatientTasksService


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
