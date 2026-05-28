"""Patient portal endpoints. Every route uses CurrentPatient — the dep
enforces token_type=='patient' so staff tokens can't reach here."""
from fastapi import APIRouter

from app.api.deps import CurrentPatient, DbSession
from app.schemas.patient_auth import PatientMeOut
from app.schemas.patient_dashboard import DashboardOut
from app.schemas.patient_portal_appointments import PatientAppointmentListOut
from app.services.patient_appointments_service import PatientAppointmentsService
from app.services.patient_dashboard_service import PatientDashboardService


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
