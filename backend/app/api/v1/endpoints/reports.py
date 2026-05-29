"""Reports endpoints — US-RPT-*.

Mount prefix: /reports
All routes require a valid provider-portal JWT (CurrentUser dep).
"""
from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.reports import (
    AppointmentReportOut,
    ClinicalReportOut,
    InsightsSnapshotOut,
    PatientVolumeReportOut,
    PaymentReportOut,
    ProductivityReportOut,
)
from app.services.reports_service import ReportsService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/payments", response_model=PaymentReportOut)
async def payments_report(
    db: DbSession,
    _current: CurrentUser,
    start: date = Query(..., description="Range start (inclusive)"),
    end: date = Query(..., description="Range end (inclusive)"),
) -> PaymentReportOut:
    return await ReportsService(db).payments(start, end)


@router.get("/appointments", response_model=AppointmentReportOut)
async def appointments_report(
    db: DbSession,
    _current: CurrentUser,
    start: date = Query(...),
    end: date = Query(...),
    provider_id: UUID | None = Query(None),
) -> AppointmentReportOut:
    return await ReportsService(db).appointments(
        start, end, str(provider_id) if provider_id else None
    )


@router.get("/patient-volume", response_model=PatientVolumeReportOut)
async def patient_volume_report(
    db: DbSession,
    _current: CurrentUser,
    start: date = Query(...),
    end: date = Query(...),
) -> PatientVolumeReportOut:
    return await ReportsService(db).patient_volume(start, end)


@router.get("/clinical", response_model=ClinicalReportOut)
async def clinical_report(
    db: DbSession,
    _current: CurrentUser,
    start: date = Query(...),
    end: date = Query(...),
) -> ClinicalReportOut:
    return await ReportsService(db).clinical(start, end)


@router.get("/productivity", response_model=ProductivityReportOut)
async def productivity_report(
    db: DbSession,
    _current: CurrentUser,
    start: date = Query(...),
    end: date = Query(...),
    provider_id: UUID | None = Query(None),
) -> ProductivityReportOut:
    return await ReportsService(db).productivity(
        start, end, str(provider_id) if provider_id else None
    )


@router.get("/insights", response_model=InsightsSnapshotOut)
async def insights_snapshot(
    db: DbSession,
    _current: CurrentUser,
) -> InsightsSnapshotOut:
    return await ReportsService(db).insights()
