"""Reports service — one async method per report endpoint.

All monetary values are stored as integer cents in the DB; this service
converts to floats (dollars) before returning.

Date-range guards:
  - end < start  → HTTPException 400
  - range > 366 days → HTTPException 400 "Range too large"
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment, AppointmentStatus
from app.models.condition import Condition
from app.models.invoice import Invoice
from app.models.patient import Patient, PatientStatus, RiskLevel
from app.models.payment import Payment, PaymentStatus
from app.models.refund import Refund
from app.models.soap_note import SoapNote
from app.models.user import User, UserRole
from app.schemas.reports import (
    ARAgingBucket,
    AppointmentReportOut,
    AppointmentRow,
    AppointmentSeriesPoint,
    ClinicalReportOut,
    DemographicSlice,
    DiagnosisRow,
    InsightsAppointmentsToday,
    InsightsRiskPatient,
    InsightsRevenueToday,
    InsightsSnapshotOut,
    InsightsTopDiagnosis,
    PatientVolumePoint,
    PatientVolumeReportOut,
    PaymentReportOut,
    PaymentRow,
    PaymentSeriesPoint,
    ProductivityReportOut,
    ProviderProductivityRow,
    ReportRange,
)

_CENTS = 100.0


def _validate_range(start: date, end: date) -> None:
    if end < start:
        raise HTTPException(400, detail="end must be >= start")
    if (end - start).days > 366:
        raise HTTPException(400, detail="Range too large (max 366 days)")


def _start_dt(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def _end_dt(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=timezone.utc)


class ReportsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Payments report
    # ------------------------------------------------------------------

    async def payments(
        self, start: date, end: date
    ) -> PaymentReportOut:
        _validate_range(start, end)

        start_dt = _start_dt(start)
        end_dt = _end_dt(end)

        # --- KPI aggregates ---
        gross_q = await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(
                Payment.status == PaymentStatus.succeeded,
                Payment.created_at >= start_dt,
                Payment.created_at <= end_dt,
            )
        )
        gross_cents: int = gross_q.scalar_one()

        count_q = await self.db.execute(
            select(func.count(Payment.id)).where(
                Payment.status == PaymentStatus.succeeded,
                Payment.created_at >= start_dt,
                Payment.created_at <= end_dt,
            )
        )
        transaction_count: int = count_q.scalar_one()

        # Refunds in range
        refunds_q = await self.db.execute(
            select(func.coalesce(func.sum(Refund.amount_cents), 0)).where(
                Refund.created_at >= start_dt,
                Refund.created_at <= end_dt,
            )
        )
        refunds_cents: int = refunds_q.scalar_one()

        gross = gross_cents / _CENTS
        refunds = refunds_cents / _CENTS
        net = gross - refunds

        # --- Daily series ---
        series_q = await self.db.execute(
            select(
                func.date_trunc("day", Payment.created_at).label("day"),
                func.sum(Payment.amount_cents).label("gross_cents"),
            )
            .where(
                Payment.status == PaymentStatus.succeeded,
                Payment.created_at >= start_dt,
                Payment.created_at <= end_dt,
            )
            .group_by("day")
            .order_by("day")
        )
        daily_gross: dict[date, int] = {
            row.day.date(): row.gross_cents for row in series_q
        }

        refunds_series_q = await self.db.execute(
            select(
                func.date_trunc("day", Refund.created_at).label("day"),
                func.sum(Refund.amount_cents).label("refund_cents"),
            )
            .where(
                Refund.created_at >= start_dt,
                Refund.created_at <= end_dt,
            )
            .group_by("day")
            .order_by("day")
        )
        daily_refunds: dict[date, int] = {
            row.day.date(): row.refund_cents for row in refunds_series_q
        }

        all_days = set(daily_gross) | set(daily_refunds)
        series: list[PaymentSeriesPoint] = []
        for d in sorted(all_days):
            g = (daily_gross.get(d) or 0) / _CENTS
            r = (daily_refunds.get(d) or 0) / _CENTS
            series.append(PaymentSeriesPoint(date=d, gross=g, refunds=r, net=g - r))

        # --- Transaction list (last 200) ---
        txn_q = await self.db.execute(
            select(Payment, Patient.first_name, Patient.last_name)
            .join(Patient, Payment.patient_id == Patient.id)
            .where(
                Payment.status == PaymentStatus.succeeded,
                Payment.created_at >= start_dt,
                Payment.created_at <= end_dt,
            )
            .order_by(Payment.created_at.desc())
            .limit(200)
        )
        transactions: list[PaymentRow] = [
            PaymentRow(
                id=row.Payment.id,
                created_at=row.Payment.created_at,
                patient_name=f"{row.first_name} {row.last_name}",
                method=row.Payment.method,
                amount=row.Payment.amount_cents / _CENTS,
                status=row.Payment.status,
            )
            for row in txn_q
        ]

        # --- A/R aging (unpaid/partial invoices) ---
        today_dt = datetime.now(timezone.utc)
        aging_q = await self.db.execute(
            select(Invoice, Patient.id.label("pid"))
            .join(Patient, Invoice.patient_id == Patient.id)
            .where(
                Invoice.balance_cents > 0,
                Invoice.status.notin_(["paid", "void"]),
            )
        )
        buckets: dict[str, dict] = {
            "0-30": {"patient_ids": set(), "total": 0},
            "31-60": {"patient_ids": set(), "total": 0},
            "61-90": {"patient_ids": set(), "total": 0},
            "90+": {"patient_ids": set(), "total": 0},
        }
        for row in aging_q:
            inv = row.Invoice
            age = (today_dt - inv.created_at).days
            if age <= 30:
                key = "0-30"
            elif age <= 60:
                key = "31-60"
            elif age <= 90:
                key = "61-90"
            else:
                key = "90+"
            buckets[key]["patient_ids"].add(row.pid)
            buckets[key]["total"] += inv.balance_cents

        ar_aging = [
            ARAgingBucket(
                bucket=bk,
                patient_count=len(v["patient_ids"]),
                total_outstanding=v["total"] / _CENTS,
            )
            for bk, v in buckets.items()
        ]

        return PaymentReportOut(
            range=ReportRange(start=start, end=end),
            gross_collected=gross,
            refunds=refunds,
            net_collected=net,
            transaction_count=transaction_count,
            series=series,
            transactions=transactions,
            ar_aging=ar_aging,
        )

    # ------------------------------------------------------------------
    # Appointments report
    # ------------------------------------------------------------------

    async def appointments(
        self,
        start: date,
        end: date,
        provider_id: str | None = None,
    ) -> AppointmentReportOut:
        _validate_range(start, end)

        start_dt = _start_dt(start)
        end_dt = _end_dt(end)

        base_where = [
            Appointment.starts_at >= start_dt,
            Appointment.starts_at <= end_dt,
        ]
        if provider_id:
            base_where.append(Appointment.physician_id == provider_id)

        # --- KPIs ---
        kpi_q = await self.db.execute(
            select(
                func.count(Appointment.id).label("total"),
                func.sum(
                    case((Appointment.status == AppointmentStatus.completed, 1), else_=0)
                ).label("completed"),
                func.sum(
                    case((Appointment.status == AppointmentStatus.cancelled, 1), else_=0)
                ).label("cancelled"),
                func.sum(
                    case((Appointment.status == AppointmentStatus.no_show, 1), else_=0)
                ).label("no_show"),
            ).where(*base_where)
        )
        kpi = kpi_q.one()
        total = kpi.total or 0
        completed = kpi.completed or 0
        cancelled = kpi.cancelled or 0
        no_show = kpi.no_show or 0
        show_base = total - cancelled
        show_rate = round((completed / show_base * 100) if show_base > 0 else 0.0, 1)

        # --- Daily series ---
        series_q = await self.db.execute(
            select(
                func.date_trunc("day", Appointment.starts_at).label("day"),
                func.sum(
                    case((Appointment.status == AppointmentStatus.completed, 1), else_=0)
                ).label("completed"),
                func.sum(
                    case((Appointment.status == AppointmentStatus.cancelled, 1), else_=0)
                ).label("cancelled"),
                func.sum(
                    case((Appointment.status == AppointmentStatus.no_show, 1), else_=0)
                ).label("no_show"),
                func.sum(
                    case((Appointment.status == AppointmentStatus.scheduled, 1), else_=0)
                ).label("scheduled"),
            )
            .where(*base_where)
            .group_by("day")
            .order_by("day")
        )
        series = [
            AppointmentSeriesPoint(
                date=row.day.date(),
                completed=row.completed or 0,
                cancelled=row.cancelled or 0,
                no_show=row.no_show or 0,
                scheduled=row.scheduled or 0,
            )
            for row in series_q
        ]

        # --- By type ---
        by_type_q = await self.db.execute(
            select(
                Appointment.type.label("type"),
                func.count(Appointment.id).label("count"),
            )
            .where(*base_where)
            .group_by(Appointment.type)
            .order_by(func.count(Appointment.id).desc())
        )
        by_type = [
            {"type": row.type.value if hasattr(row.type, "value") else str(row.type), "count": row.count}
            for row in by_type_q
        ]

        # --- Row list ---
        rows_q = await self.db.execute(
            select(
                Appointment,
                Patient.first_name.label("p_first"),
                Patient.last_name.label("p_last"),
                User.full_name.label("provider_name"),
            )
            .join(Patient, Appointment.patient_id == Patient.id)
            .outerjoin(User, Appointment.physician_id == User.id)
            .where(*base_where)
            .order_by(Appointment.starts_at.desc())
            .limit(500)
        )
        rows = [
            AppointmentRow(
                id=row.Appointment.id,
                starts_at=row.Appointment.starts_at,
                patient_name=f"{row.p_first} {row.p_last}",
                provider_name=row.provider_name,
                type=row.Appointment.type.value if row.Appointment.type else None,
                status=row.Appointment.status.value if hasattr(row.Appointment.status, "value") else str(row.Appointment.status),
                duration_minutes=row.Appointment.duration_minutes,
            )
            for row in rows_q
        ]

        return AppointmentReportOut(
            range=ReportRange(start=start, end=end),
            total=total,
            completed=completed,
            cancelled=cancelled,
            no_show=no_show,
            show_rate=show_rate,
            series=series,
            rows=rows,
            by_type=by_type,
        )

    # ------------------------------------------------------------------
    # Patient Volume report
    # ------------------------------------------------------------------

    async def patient_volume(
        self, start: date, end: date
    ) -> PatientVolumeReportOut:
        _validate_range(start, end)

        start_dt = _start_dt(start)
        end_dt = _end_dt(end)

        # Total active patients
        total_q = await self.db.execute(
            select(func.count(Patient.id)).where(
                Patient.status != PatientStatus.discharged
            )
        )
        total_active: int = total_q.scalar_one() or 0

        # New patients in period
        new_q = await self.db.execute(
            select(func.count(Patient.id)).where(
                Patient.created_at >= start_dt,
                Patient.created_at <= end_dt,
            )
        )
        new_in_period: int = new_q.scalar_one() or 0

        # Returning = had an appointment in period but created_at before start
        returning_q = await self.db.execute(
            select(func.count(func.distinct(Appointment.patient_id))).where(
                Appointment.starts_at >= start_dt,
                Appointment.starts_at <= end_dt,
                Appointment.patient_id.notin_(
                    select(Patient.id).where(
                        Patient.created_at >= start_dt,
                        Patient.created_at <= end_dt,
                    )
                ),
            )
        )
        returning_in_period: int = returning_q.scalar_one() or 0

        # Daily new patients series
        series_q = await self.db.execute(
            select(
                func.date_trunc("day", Patient.created_at).label("day"),
                func.count(Patient.id).label("cnt"),
            )
            .where(
                Patient.created_at >= start_dt,
                Patient.created_at <= end_dt,
            )
            .group_by("day")
            .order_by("day")
        )
        series = [
            PatientVolumePoint(date=row.day.date(), new_patients=row.cnt)
            for row in series_q
        ]

        # By sex
        sex_q = await self.db.execute(
            select(Patient.sex, func.count(Patient.id).label("cnt"))
            .group_by(Patient.sex)
            .order_by(func.count(Patient.id).desc())
        )
        by_sex = [
            DemographicSlice(label=row.sex or "Unknown", count=row.cnt)
            for row in sex_q
        ]

        # By age band
        today = date.today()
        all_dobs = await self.db.execute(select(Patient.dob))
        bands: dict[str, int] = {
            "0-17": 0, "18-34": 0, "35-49": 0, "50-64": 0, "65+": 0
        }
        for (dob,) in all_dobs:
            if dob is None:
                continue
            age = (today - dob).days // 365
            if age <= 17:
                bands["0-17"] += 1
            elif age <= 34:
                bands["18-34"] += 1
            elif age <= 49:
                bands["35-49"] += 1
            elif age <= 64:
                bands["50-64"] += 1
            else:
                bands["65+"] += 1

        by_age_band = [
            DemographicSlice(label=lbl, count=cnt)
            for lbl, cnt in bands.items()
        ]

        return PatientVolumeReportOut(
            range=ReportRange(start=start, end=end),
            total_active=total_active,
            new_in_period=new_in_period,
            returning_in_period=returning_in_period,
            series=series,
            by_sex=by_sex,
            by_age_band=by_age_band,
        )

    # ------------------------------------------------------------------
    # Clinical report
    # ------------------------------------------------------------------

    async def clinical(self, start: date, end: date) -> ClinicalReportOut:
        _validate_range(start, end)

        start_dt = _start_dt(start)
        end_dt = _end_dt(end)

        # Encounter count — SoapNote preferred
        enc_q = await self.db.execute(
            select(func.count(SoapNote.id)).where(
                SoapNote.created_at >= start_dt,
                SoapNote.created_at <= end_dt,
            )
        )
        total_encounters: int = enc_q.scalar_one() or 0

        # Fallback: completed appointments if no notes yet
        if total_encounters == 0:
            fallback_q = await self.db.execute(
                select(func.count(Appointment.id)).where(
                    Appointment.status == AppointmentStatus.completed,
                    Appointment.starts_at >= start_dt,
                    Appointment.starts_at <= end_dt,
                )
            )
            total_encounters = fallback_q.scalar_one() or 0

        # Top diagnoses from Condition rows
        diag_q = await self.db.execute(
            select(
                Condition.icd10,
                Condition.name,
                func.count(Condition.id).label("cnt"),
            )
            .where(
                Condition.created_at >= start_dt,
                Condition.created_at <= end_dt,
            )
            .group_by(Condition.icd10, Condition.name)
            .order_by(func.count(Condition.id).desc())
            .limit(20)
        )
        top_diagnoses = [
            DiagnosisRow(icd10=row.icd10, name=row.name, count=row.cnt)
            for row in diag_q
        ]
        distinct_diagnoses = len(top_diagnoses)

        return ClinicalReportOut(
            range=ReportRange(start=start, end=end),
            total_encounters=total_encounters,
            distinct_diagnoses=distinct_diagnoses,
            top_diagnoses=top_diagnoses,
        )

    # ------------------------------------------------------------------
    # Productivity report
    # ------------------------------------------------------------------

    async def productivity(
        self,
        start: date,
        end: date,
        provider_id: str | None = None,
    ) -> ProductivityReportOut:
        _validate_range(start, end)

        start_dt = _start_dt(start)
        end_dt = _end_dt(end)

        # Get providers (role=provider or admin)
        prov_where = [
            User.is_active.is_(True),
            User.role.in_([UserRole.provider, UserRole.admin]),
        ]
        if provider_id:
            prov_where.append(User.id == provider_id)

        providers_q = await self.db.execute(
            select(User).where(*prov_where).order_by(User.full_name)
        )
        providers = list(providers_q.scalars())

        rows: list[ProviderProductivityRow] = []
        for prov in providers:
            # Appointments completed
            appt_q = await self.db.execute(
                select(
                    func.count(Appointment.id).label("completed"),
                    func.avg(Appointment.duration_minutes).label("avg_dur"),
                    func.sum(
                        case((Appointment.status == AppointmentStatus.no_show, 1), else_=0)
                    ).label("no_show"),
                ).where(
                    Appointment.physician_id == prov.id,
                    Appointment.starts_at >= start_dt,
                    Appointment.starts_at <= end_dt,
                    Appointment.status == AppointmentStatus.completed,
                )
            )
            appt_row = appt_q.one()

            # no-show count is separate (can't mix completed filter with no_show count)
            nshow_q = await self.db.execute(
                select(func.count(Appointment.id)).where(
                    Appointment.physician_id == prov.id,
                    Appointment.starts_at >= start_dt,
                    Appointment.starts_at <= end_dt,
                    Appointment.status == AppointmentStatus.no_show,
                )
            )
            no_show_count: int = nshow_q.scalar_one() or 0

            # SOAP notes signed
            notes_q = await self.db.execute(
                select(func.count(SoapNote.id)).where(
                    SoapNote.author_id == prov.id,
                    SoapNote.created_at >= start_dt,
                    SoapNote.created_at <= end_dt,
                )
            )
            notes_signed: int = notes_q.scalar_one() or 0

            rows.append(
                ProviderProductivityRow(
                    provider_id=prov.id,
                    provider_name=prov.full_name,
                    specialty=prov.specialty,
                    appointments_completed=appt_row.completed or 0,
                    notes_signed=notes_signed,
                    avg_duration_minutes=round(float(appt_row.avg_dur or 0), 1),
                    no_show_count=no_show_count,
                )
            )

        return ProductivityReportOut(
            range=ReportRange(start=start, end=end),
            providers=rows,
        )

    # ------------------------------------------------------------------
    # Insights snapshot
    # ------------------------------------------------------------------

    async def insights(self) -> InsightsSnapshotOut:
        today = date.today()
        today_start = _start_dt(today)
        today_end = _end_dt(today)
        now = datetime.now(timezone.utc)

        # Revenue today
        rev_q = await self.db.execute(
            select(
                func.coalesce(func.sum(Payment.amount_cents), 0).label("gross"),
                func.count(Payment.id).label("cnt"),
            ).where(
                Payment.status == PaymentStatus.succeeded,
                Payment.created_at >= today_start,
                Payment.created_at <= today_end,
            )
        )
        rev = rev_q.one()
        gross_today = (rev.gross or 0) / _CENTS

        refunds_today_q = await self.db.execute(
            select(func.coalesce(func.sum(Refund.amount_cents), 0)).where(
                Refund.created_at >= today_start,
                Refund.created_at <= today_end,
            )
        )
        refunds_today = (refunds_today_q.scalar_one() or 0) / _CENTS

        revenue_today = InsightsRevenueToday(
            gross=gross_today,
            net=gross_today - refunds_today,
            transaction_count=rev.cnt or 0,
        )

        # Appointments today
        appt_today_q = await self.db.execute(
            select(
                func.count(Appointment.id).label("total"),
                func.sum(
                    case((Appointment.status == AppointmentStatus.completed, 1), else_=0)
                ).label("completed"),
                func.sum(
                    case(
                        (
                            (Appointment.starts_at > now)
                            & Appointment.status.in_(
                                [AppointmentStatus.scheduled, AppointmentStatus.confirmed]
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ).label("remaining"),
            ).where(
                Appointment.starts_at >= today_start,
                Appointment.starts_at <= today_end,
            )
        )
        at = appt_today_q.one()
        appointments_today = InsightsAppointmentsToday(
            total=at.total or 0,
            completed=at.completed or 0,
            remaining=at.remaining or 0,
        )

        # No-show rate last 30 days vs prev 30 days
        async def _no_show_rate(s: date, e: date) -> float:
            r = await self.db.execute(
                select(
                    func.count(Appointment.id).label("total"),
                    func.sum(
                        case((Appointment.status == AppointmentStatus.no_show, 1), else_=0)
                    ).label("no_show"),
                ).where(
                    Appointment.starts_at >= _start_dt(s),
                    Appointment.starts_at <= _end_dt(e),
                )
            )
            row = r.one()
            t = row.total or 0
            return round((row.no_show or 0) / t * 100, 1) if t else 0.0

        thirty_start = today - timedelta(days=30)
        prev_start = today - timedelta(days=60)
        prev_end = today - timedelta(days=31)

        no_show_rate_30d = await _no_show_rate(thirty_start, today)
        no_show_rate_prev_30d = await _no_show_rate(prev_start, prev_end)

        # Top 5 diagnoses last 30 days
        diag_q = await self.db.execute(
            select(
                Condition.icd10,
                Condition.name,
                func.count(Condition.id).label("cnt"),
            )
            .where(
                Condition.created_at >= _start_dt(thirty_start),
                Condition.created_at <= today_end,
            )
            .group_by(Condition.icd10, Condition.name)
            .order_by(func.count(Condition.id).desc())
            .limit(5)
        )
        top_diagnoses_30d = [
            InsightsTopDiagnosis(icd10=row.icd10, name=row.name, count=row.cnt)
            for row in diag_q
        ]

        # Risk patients — last 5 patients with high or moderate risk
        risk_q = await self.db.execute(
            select(Patient)
            .where(Patient.risk.in_([RiskLevel.high, RiskLevel.moderate]))
            .order_by(Patient.updated_at.desc())
            .limit(5)
        )
        risk_patients = [
            InsightsRiskPatient(
                patient_id=p.id,
                patient_name=p.full_name,
                risk_level=p.risk.value,
                reason=p.condition_tag or "Active risk flag",
            )
            for p in risk_q.scalars()
        ]

        # Monthly revenue series (last 30 days)
        rev_series_q = await self.db.execute(
            select(
                func.date_trunc("day", Payment.created_at).label("day"),
                func.sum(Payment.amount_cents).label("gross_cents"),
            )
            .where(
                Payment.status == PaymentStatus.succeeded,
                Payment.created_at >= _start_dt(thirty_start),
                Payment.created_at <= today_end,
            )
            .group_by("day")
            .order_by("day")
        )
        rev_refunds_q = await self.db.execute(
            select(
                func.date_trunc("day", Refund.created_at).label("day"),
                func.sum(Refund.amount_cents).label("refund_cents"),
            )
            .where(
                Refund.created_at >= _start_dt(thirty_start),
                Refund.created_at <= today_end,
            )
            .group_by("day")
            .order_by("day")
        )
        daily_gross_ins = {r.day.date(): r.gross_cents for r in rev_series_q}
        daily_ref_ins = {r.day.date(): r.refund_cents for r in rev_refunds_q}
        all_days_ins = set(daily_gross_ins) | set(daily_ref_ins)
        monthly_revenue_series = [
            PaymentSeriesPoint(
                date=d,
                gross=(daily_gross_ins.get(d) or 0) / _CENTS,
                refunds=(daily_ref_ins.get(d) or 0) / _CENTS,
                net=((daily_gross_ins.get(d) or 0) - (daily_ref_ins.get(d) or 0)) / _CENTS,
            )
            for d in sorted(all_days_ins)
        ]

        return InsightsSnapshotOut(
            revenue_today=revenue_today,
            appointments_today=appointments_today,
            no_show_rate_30d=no_show_rate_30d,
            no_show_rate_prev_30d=no_show_rate_prev_30d,
            top_diagnoses_30d=top_diagnoses_30d,
            risk_patients=risk_patients,
            monthly_revenue_series=monthly_revenue_series,
        )
