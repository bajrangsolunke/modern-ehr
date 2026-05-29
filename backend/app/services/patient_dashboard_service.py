"""Composition-only service for the patient dashboard. Pulls slim
projections from existing tables — does not add new business logic."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment, AppointmentStatus
from app.models.condition import Condition
from app.models.conversation import Conversation, Message
from app.models.document import Document
from app.models.form_request import FormRequest, FormRequestStatus
from app.models.patient import Patient
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.models.vital import VitalSign
from app.schemas.patient_dashboard import (
    DashboardAppointmentItem,
    DashboardConditionInfo,
    DashboardGreeting,
    DashboardHealthMetric,
    DashboardNextAppointment,
    DashboardOut,
    DashboardPendingActions,
    DashboardProfile,
    DashboardRecentDocument,
    DashboardRecentMessage,
    HealthMetricStatus,
)


# ---------------------------------------------------------------------------
# Normal ranges for status classification
# ---------------------------------------------------------------------------
_RANGES: dict[str, dict[str, float]] = {
    "heart_rate":              {"lo_crit": 0, "lo": 50,   "hi": 100,  "hi_crit": 150},
    "blood_pressure_systolic": {"lo_crit": 0, "lo": 90,   "hi": 140,  "hi_crit": 180},
    "glucose":                 {"lo_crit": 0, "lo": 70,   "hi": 140,  "hi_crit": 250},
    "hemoglobin":              {"lo_crit": 0, "lo": 12,   "hi": 17,   "hi_crit": 999},
    "temperature":             {"lo_crit": 0, "lo": 36.1, "hi": 37.5, "hi_crit": 999},
    "respiratory_rate":        {"lo_crit": 0, "lo": 12,   "hi": 20,   "hi_crit": 999},
}

_METRIC_META: dict[str, dict[str, str]] = {
    "heart_rate":      {"label": "Heart Rate",       "unit": "bpm"},
    "blood_pressure":  {"label": "Blood Pressure",   "unit": "mmHg"},
    "glucose":         {"label": "Glucose",          "unit": "mg/dL"},
    "hemoglobin":      {"label": "Hemoglobin",       "unit": "g/dL"},
    "weight":          {"label": "Weight",           "unit": "kg"},
    "temperature":     {"label": "Temperature",      "unit": "°C"},
    "respiratory_rate": {"label": "Respiratory Rate", "unit": "/min"},
}

_METRIC_ORDER = [
    "heart_rate", "blood_pressure", "glucose",
    "hemoglobin", "weight", "temperature", "respiratory_rate",
]


def _classify(metric: str, value: float) -> tuple[HealthMetricStatus, str | None]:
    """Return (status, status_text) for a single numeric value."""
    if metric == "weight":
        return "normal", "Normal"
    r = _RANGES.get(metric)
    if r is None:
        return "unknown", None
    if value >= r["hi_crit"]:
        return "critical", "Critical — seek care"
    if value > r["hi"]:
        return "higher", "Higher than average"
    if value < r["lo"]:
        return "lower", "Lower than average"
    return "normal", "Normal"


class PatientDashboardService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def for_patient(self, patient: Patient) -> DashboardOut:
        return DashboardOut(
            greeting=DashboardGreeting(first_name=patient.first_name),
            profile=await self._profile(patient),
            health_metrics=await self._health_metrics(patient.id),
            primary_condition=await self._primary_condition(patient.id),
            recent_appointments=await self._recent_appointments(patient.id),
            next_appointment=await self._next_appointment(patient.id),
            pending_actions=await self._pending_actions(patient.id),
            recent_message=await self._recent_message(patient.id),
            recent_documents=await self._recent_documents(patient.id),
        )

    # ------------------------------------------------------------------
    # Profile
    # ------------------------------------------------------------------

    async def _profile(self, patient: Patient) -> DashboardProfile:
        # Derive age from dob
        age: int | None = None
        if patient.dob:
            today = date.today()
            age = (
                today.year - patient.dob.year
                - ((today.month, today.day) < (patient.dob.month, patient.dob.day))
            )

        # Map sex to display gender
        sex_map = {"m": "Male", "f": "Female", "male": "Male", "female": "Female"}
        gender = sex_map.get((patient.sex or "").lower(), "Other") if patient.sex else None

        # Latest height and weight from vitals
        height_cm: float | None = None
        weight_kg: float | None = None

        for metric, attr_name in [("height", "height_cm"), ("weight", "weight_kg")]:
            row = (
                await self.db.execute(
                    select(VitalSign)
                    .where(
                        VitalSign.patient_id == patient.id,
                        VitalSign.metric == metric,
                    )
                    .order_by(VitalSign.recorded_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if row is not None:
                if attr_name == "height_cm":
                    height_cm = float(row.value)
                else:
                    weight_kg = float(row.value)

        return DashboardProfile(
            gender=gender,
            age=age,
            dob=patient.dob,
            height_cm=height_cm,
            weight_kg=weight_kg,
            avatar_url=patient.avatar_url,
        )

    # ------------------------------------------------------------------
    # Health metrics
    # ------------------------------------------------------------------

    async def _health_metrics(self, patient_id: UUID) -> list[DashboardHealthMetric]:
        # Pull last 7 readings per metric (all at once, filter in Python)
        rows = (
            await self.db.execute(
                select(VitalSign)
                .where(VitalSign.patient_id == patient_id)
                .order_by(VitalSign.metric, VitalSign.recorded_at.desc())
            )
        ).scalars().all()

        # Group by metric
        by_metric: dict[str, list[VitalSign]] = {}
        for r in rows:
            by_metric.setdefault(r.metric, []).append(r)

        # Keep only the 7 most recent per metric
        for m in by_metric:
            by_metric[m] = by_metric[m][:7]

        metrics: dict[str, DashboardHealthMetric] = {}

        # Blood pressure — combine systolic + diastolic
        sys_rows = by_metric.get("blood_pressure_systolic", [])
        dia_rows = by_metric.get("blood_pressure_diastolic", [])
        if sys_rows:
            latest_sys = sys_rows[0]
            latest_dia = dia_rows[0] if dia_rows else None
            bp_value = (
                f"{int(latest_sys.value)}/{int(latest_dia.value)}"
                if latest_dia else str(int(latest_sys.value))
            )
            # Use systolic for classification
            status, status_text = _classify("blood_pressure_systolic", float(latest_sys.value))
            series = [float(r.value) for r in reversed(sys_rows)]
            metrics["blood_pressure"] = DashboardHealthMetric(
                metric="blood_pressure",
                label="Blood Pressure",
                value=bp_value,
                unit="mmHg",
                recorded_at=latest_sys.recorded_at,
                status=status,
                status_text=status_text,
                series=series if len(series) >= 2 else [],
            )

        # Remaining metrics
        for metric_key, readings in by_metric.items():
            # Skip raw BP sub-metrics — already handled above
            if metric_key in ("blood_pressure_systolic", "blood_pressure_diastolic"):
                continue
            if metric_key not in _METRIC_META:
                continue
            meta = _METRIC_META[metric_key]
            latest = readings[0]
            status, status_text = _classify(metric_key, float(latest.value))
            series = [float(r.value) for r in reversed(readings)]
            metrics[metric_key] = DashboardHealthMetric(
                metric=metric_key,
                label=meta["label"],
                value=str(round(float(latest.value), 1)),
                unit=meta["unit"],
                recorded_at=latest.recorded_at,
                status=status,
                status_text=status_text,
                series=series if len(series) >= 2 else [],
            )

        # Return in canonical order, cap to 6 tiles
        result: list[DashboardHealthMetric] = []
        for key in _METRIC_ORDER:
            if key in metrics:
                result.append(metrics[key])
            if len(result) == 6:
                break
        return result

    # ------------------------------------------------------------------
    # Primary condition
    # ------------------------------------------------------------------

    async def _primary_condition(self, patient_id: UUID) -> DashboardConditionInfo | None:
        row = (
            await self.db.execute(
                select(Condition)
                .where(Condition.patient_id == patient_id)
                .order_by(Condition.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if row is None:
            return None

        # Condition model has: icd10, onset_date — map to spec names defensively
        code: str | None = getattr(row, "icd10", None)
        diagnosed_at: date | None = getattr(row, "onset_date", None)
        treatment: str | None = getattr(row, "treatment", None)

        return DashboardConditionInfo(
            code=code,
            name=row.name,
            diagnosed_at=diagnosed_at,
            treatment=treatment,
        )

    # ------------------------------------------------------------------
    # Recent appointments
    # ------------------------------------------------------------------

    async def _recent_appointments(
        self, patient_id: UUID, limit: int = 4
    ) -> list[DashboardAppointmentItem]:
        rows = (
            await self.db.execute(
                select(Appointment)
                .where(
                    Appointment.patient_id == patient_id,
                    Appointment.status != AppointmentStatus.cancelled,
                )
                .order_by(Appointment.starts_at.desc())
                .limit(limit)
            )
        ).scalars().all()

        items: list[DashboardAppointmentItem] = []
        for appt in rows:
            provider_name: str | None = None
            if appt.physician_id:
                provider = await self.db.get(User, appt.physician_id)
                if provider:
                    provider_name = provider.full_name
            items.append(
                DashboardAppointmentItem(
                    id=appt.id,
                    starts_at=appt.starts_at,
                    appointment_type=appt.type.value if appt.type else None,
                    status=appt.status.value,
                    provider_name=provider_name,
                )
            )
        return items

    # ------------------------------------------------------------------
    # Existing methods (unchanged)
    # ------------------------------------------------------------------

    async def _next_appointment(
        self, patient_id: UUID
    ) -> DashboardNextAppointment | None:
        now = datetime.now(timezone.utc)
        row = (
            await self.db.execute(
                select(Appointment)
                .where(
                    Appointment.patient_id == patient_id,
                    Appointment.starts_at >= now,
                    Appointment.status.in_(
                        [
                            AppointmentStatus.scheduled,
                            AppointmentStatus.confirmed,
                        ]
                    ),
                )
                .order_by(Appointment.starts_at.asc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if row is None:
            return None

        provider_name = None
        specialty = None
        provider_avatar_url = None
        if row.physician_id:
            provider = await self.db.get(User, row.physician_id)
            if provider is not None:
                provider_name = provider.full_name
                specialty = provider.specialty
                provider_avatar_url = provider.avatar_url
        return DashboardNextAppointment(
            id=row.id,
            starts_at=row.starts_at,
            provider_name=provider_name,
            provider_avatar_url=provider_avatar_url,
            specialty=specialty,
            location=row.room,
            appointment_type=row.type.value if row.type else None,
        )

    async def _pending_actions(
        self, patient_id: UUID
    ) -> DashboardPendingActions:
        forms_count = int(
            (
                await self.db.execute(
                    select(func.count(FormRequest.id)).where(
                        FormRequest.patient_id == patient_id,
                        FormRequest.status == FormRequestStatus.pending,
                    )
                )
            ).scalar_one()
        )
        tasks_count = int(
            (
                await self.db.execute(
                    select(func.count(Task.id)).where(
                        Task.patient_id == patient_id,
                        Task.status.in_(
                            [TaskStatus.new, TaskStatus.in_progress]
                        ),
                    )
                )
            ).scalar_one()
        )
        return DashboardPendingActions(
            forms_count=forms_count,
            tasks_count=tasks_count,
            total=forms_count + tasks_count,
        )

    async def _recent_message(
        self, patient_id: UUID
    ) -> DashboardRecentMessage | None:
        conv = (
            await self.db.execute(
                select(Conversation)
                .where(Conversation.patient_id == patient_id)
                .order_by(Conversation.last_message_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if conv is None or conv.last_message_preview is None:
            return None
        sender_name = None
        sender_avatar_url = None
        latest = (
            await self.db.execute(
                select(Message)
                .where(Message.conversation_id == conv.id)
                .order_by(Message.sent_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if latest is not None and latest.sender_user_id is not None:
            sender = await self.db.get(User, latest.sender_user_id)
            if sender is not None:
                sender_name = sender.full_name
                sender_avatar_url = sender.avatar_url
        return DashboardRecentMessage(
            conversation_id=conv.id,
            sender_name=sender_name,
            sender_avatar_url=sender_avatar_url,
            preview=conv.last_message_preview,
            sent_at=conv.last_message_at,
        )

    async def _recent_documents(
        self, patient_id: UUID
    ) -> list[DashboardRecentDocument]:
        rows = (
            await self.db.execute(
                select(Document)
                .where(Document.patient_id == patient_id)
                .order_by(Document.created_at.desc())
                .limit(3)
            )
        ).scalars().all()
        return [
            DashboardRecentDocument(
                id=d.id, name=d.name, category=d.category, created_at=d.created_at
            )
            for d in rows
        ]
