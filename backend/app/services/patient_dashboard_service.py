"""Composition-only service for the patient dashboard. Pulls slim
projections from existing tables — does not add new business logic."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment, AppointmentStatus
from app.models.conversation import Conversation, Message
from app.models.document import Document
from app.models.form_request import FormRequest, FormRequestStatus
from app.models.patient import Patient
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.patient_dashboard import (
    DashboardGreeting,
    DashboardNextAppointment,
    DashboardOut,
    DashboardPendingActions,
    DashboardRecentDocument,
    DashboardRecentMessage,
)


class PatientDashboardService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def for_patient(self, patient: Patient) -> DashboardOut:
        return DashboardOut(
            greeting=DashboardGreeting(first_name=patient.first_name),
            next_appointment=await self._next_appointment(patient.id),
            pending_actions=await self._pending_actions(patient.id),
            recent_message=await self._recent_message(patient.id),
            recent_documents=await self._recent_documents(patient.id),
        )

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
        if row.physician_id:
            provider = await self.db.get(User, row.physician_id)
            if provider is not None:
                provider_name = provider.full_name
                specialty = provider.specialty
        return DashboardNextAppointment(
            id=row.id,
            starts_at=row.starts_at,
            provider_name=provider_name,
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
            sender_name = sender.full_name if sender else None
        return DashboardRecentMessage(
            conversation_id=conv.id,
            sender_name=sender_name,
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
