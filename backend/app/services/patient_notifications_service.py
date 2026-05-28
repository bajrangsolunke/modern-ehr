"""Composes the patient notification feed from real state changes.

We don't write a separate notifications table for patients; we read
from the source tables (conversations, appointments, documents,
form_requests) and merge them into a single chronological feed."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment, AppointmentStatus
from app.models.conversation import Conversation, Message
from app.models.document import Document
from app.models.form_request import FormRequest, FormRequestStatus
from app.models.user import User
from app.schemas.patient_portal_notifications import (
    PatientNotificationListOut,
    PatientNotificationOut,
)


class PatientNotificationsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_patient(
        self, patient_id: UUID, limit: int = 25
    ) -> PatientNotificationListOut:
        items: list[PatientNotificationOut] = []
        items.extend(await self._from_messages(patient_id))
        items.extend(await self._from_appointments(patient_id))
        items.extend(await self._from_documents(patient_id))
        items.extend(await self._from_forms(patient_id))
        items.sort(key=lambda x: x.timestamp, reverse=True)
        items = items[:limit]
        return PatientNotificationListOut(items=items, total=len(items))

    async def _from_messages(
        self, patient_id: UUID
    ) -> list[PatientNotificationOut]:
        conv_rows = (
            await self.db.execute(
                select(Conversation)
                .where(Conversation.patient_id == patient_id)
                .order_by(Conversation.last_message_at.desc())
                .limit(10)
            )
        ).scalars().all()
        if not conv_rows:
            return []

        # Look up the most recent incoming message in each conversation
        # so the notification surfaces "X sent you a message" rather than
        # a generic stamp.
        out: list[PatientNotificationOut] = []
        for conv in conv_rows:
            latest = (
                await self.db.execute(
                    select(Message)
                    .where(Message.conversation_id == conv.id)
                    .order_by(Message.sent_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if latest is None or latest.sender_patient_id == patient_id:
                # Skip outbound — we only notify on inbound messages.
                continue
            sender_name = None
            if latest.sender_user_id:
                sender = await self.db.get(User, latest.sender_user_id)
                sender_name = sender.full_name if sender else None
            out.append(
                PatientNotificationOut(
                    id=f"message:{conv.id}",
                    kind="message",
                    title=(
                        f"New message from {sender_name}"
                        if sender_name
                        else "New message from your care team"
                    ),
                    body=conv.last_message_preview,
                    timestamp=latest.sent_at,
                    href="/messages",
                )
            )
        return out

    async def _from_appointments(
        self, patient_id: UUID
    ) -> list[PatientNotificationOut]:
        now = datetime.now(timezone.utc)
        horizon = now + timedelta(days=7)
        rows = (
            await self.db.execute(
                select(Appointment)
                .where(
                    Appointment.patient_id == patient_id,
                    Appointment.starts_at >= now,
                    Appointment.starts_at <= horizon,
                    Appointment.status.in_(
                        [AppointmentStatus.scheduled, AppointmentStatus.confirmed]
                    ),
                )
                .order_by(Appointment.starts_at.asc())
            )
        ).scalars().all()
        out: list[PatientNotificationOut] = []
        for r in rows:
            provider_name = None
            if r.physician_id:
                provider = await self.db.get(User, r.physician_id)
                provider_name = provider.full_name if provider else None
            out.append(
                PatientNotificationOut(
                    id=f"appointment:{r.id}",
                    kind="appointment",
                    title="Upcoming appointment",
                    body=(
                        f"with {provider_name}"
                        if provider_name
                        else "with your care team"
                    ),
                    timestamp=r.starts_at,
                    href="/appointments",
                )
            )
        return out

    async def _from_documents(
        self, patient_id: UUID
    ) -> list[PatientNotificationOut]:
        rows = (
            await self.db.execute(
                select(Document)
                .where(Document.patient_id == patient_id)
                .order_by(Document.created_at.desc())
                .limit(10)
            )
        ).scalars().all()
        return [
            PatientNotificationOut(
                id=f"document:{r.id}",
                kind="document",
                title="New document shared",
                body=r.name,
                timestamp=r.created_at,
                href="/docs",
            )
            for r in rows
        ]

    async def _from_forms(
        self, patient_id: UUID
    ) -> list[PatientNotificationOut]:
        rows = (
            await self.db.execute(
                select(FormRequest)
                .where(
                    FormRequest.patient_id == patient_id,
                    FormRequest.status == FormRequestStatus.pending,
                )
                .order_by(FormRequest.created_at.desc())
                .limit(10)
            )
        ).scalars().all()
        return [
            PatientNotificationOut(
                id=f"form:{r.id}",
                kind="form",
                title="Form to complete",
                body=r.form_type.value if r.form_type else None,
                timestamp=r.created_at,
                href="/tasks",
            )
            for r in rows
        ]
