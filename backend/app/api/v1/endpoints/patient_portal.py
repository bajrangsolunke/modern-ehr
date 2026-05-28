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
from app.schemas.patient_portal_notifications import PatientNotificationListOut
from app.services.patient_appointments_service import PatientAppointmentsService
from app.services.patient_dashboard_service import PatientDashboardService
from app.services.patient_documents_service import PatientDocumentsService
from app.services.patient_notifications_service import PatientNotificationsService


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
