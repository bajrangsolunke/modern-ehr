"""Pydantic v2 schemas for the Reports module (US-RPT-*)."""
from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------


class ReportRange(BaseModel):
    start: date
    end: date


# ---------------------------------------------------------------------------
# Payments  (US-RPT-PAY-1)
# ---------------------------------------------------------------------------


class PaymentSeriesPoint(BaseModel):
    date: date
    gross: float
    refunds: float
    net: float


class PaymentRow(BaseModel):
    id: UUID
    created_at: datetime
    patient_name: str
    method: str | None
    amount: float
    status: str


class ARAgingBucket(BaseModel):
    bucket: str  # "0-30" | "31-60" | "61-90" | "90+"
    patient_count: int
    total_outstanding: float


class PaymentReportOut(BaseModel):
    range: ReportRange
    gross_collected: float
    refunds: float
    net_collected: float
    transaction_count: int
    series: list[PaymentSeriesPoint]
    transactions: list[PaymentRow]
    ar_aging: list[ARAgingBucket]


# ---------------------------------------------------------------------------
# Appointments  (US-RPT-APT-1)
# ---------------------------------------------------------------------------


class AppointmentSeriesPoint(BaseModel):
    date: date
    completed: int
    cancelled: int
    no_show: int
    scheduled: int


class AppointmentRow(BaseModel):
    id: UUID
    starts_at: datetime
    patient_name: str
    provider_name: str | None
    type: str | None
    status: str
    duration_minutes: int | None


class AppointmentReportOut(BaseModel):
    range: ReportRange
    total: int
    completed: int
    cancelled: int
    no_show: int
    show_rate: float  # 0-100
    series: list[AppointmentSeriesPoint]
    rows: list[AppointmentRow]
    by_type: list[dict]  # [{"type": "follow_up", "count": 12}, ...]


# ---------------------------------------------------------------------------
# Patient Volume  (US-RPT-PVOL-1)
# ---------------------------------------------------------------------------


class PatientVolumePoint(BaseModel):
    date: date
    new_patients: int


class DemographicSlice(BaseModel):
    label: str
    count: int


class PatientVolumeReportOut(BaseModel):
    range: ReportRange
    total_active: int
    new_in_period: int
    returning_in_period: int
    series: list[PatientVolumePoint]
    by_sex: list[DemographicSlice]
    by_age_band: list[DemographicSlice]  # 0-17, 18-34, 35-49, 50-64, 65+


# ---------------------------------------------------------------------------
# Clinical  (US-RPT-CLN-1)
# ---------------------------------------------------------------------------


class DiagnosisRow(BaseModel):
    icd10: str | None
    name: str
    count: int


class ClinicalReportOut(BaseModel):
    range: ReportRange
    total_encounters: int  # SoapNote count in range; fallback to completed Appointments
    distinct_diagnoses: int
    top_diagnoses: list[DiagnosisRow]  # up to 20


# ---------------------------------------------------------------------------
# Productivity  (US-RPT-PROD-1)
# ---------------------------------------------------------------------------


class ProviderProductivityRow(BaseModel):
    provider_id: UUID
    provider_name: str
    specialty: str | None
    appointments_completed: int
    notes_signed: int  # SoapNote count
    avg_duration_minutes: float
    no_show_count: int


class ProductivityReportOut(BaseModel):
    range: ReportRange
    providers: list[ProviderProductivityRow]


# ---------------------------------------------------------------------------
# Insights snapshot  (US-RPT-INS-1)
# ---------------------------------------------------------------------------


class InsightsRevenueToday(BaseModel):
    gross: float
    net: float
    transaction_count: int


class InsightsAppointmentsToday(BaseModel):
    total: int
    completed: int
    remaining: int


class InsightsTopDiagnosis(BaseModel):
    icd10: str | None
    name: str
    count: int


class InsightsRiskPatient(BaseModel):
    patient_id: UUID
    patient_name: str
    risk_level: str  # high / moderate / low
    reason: str


class InsightsSnapshotOut(BaseModel):
    revenue_today: InsightsRevenueToday
    appointments_today: InsightsAppointmentsToday
    no_show_rate_30d: float  # 0-100
    no_show_rate_prev_30d: float
    top_diagnoses_30d: list[InsightsTopDiagnosis]  # top 5
    risk_patients: list[InsightsRiskPatient]  # latest 5 high/moderate
    monthly_revenue_series: list[PaymentSeriesPoint]  # last 30 days
