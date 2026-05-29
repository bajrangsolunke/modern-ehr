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

        # Batch-fetch the latest message per conversation in ONE query
        # using a DISTINCT ON. Then batch-fetch every sender user in
        # one IN clause. Drops what was N+1 (up to 30 queries for 10
        # conversations) down to 3 queries total.
        from sqlalchemy import distinct  # noqa: F401 — kept for clarity

        conv_ids = [c.id for c in conv_rows]
        latest_rows = (
            await self.db.execute(
                select(Message)
                .where(Message.conversation_id.in_(conv_ids))
                .order_by(
                    Message.conversation_id,
                    Message.sent_at.desc(),
                )
                .distinct(Message.conversation_id)
            )
        ).scalars().all()
        latest_by_conv: dict[UUID, Message] = {
            m.conversation_id: m for m in latest_rows
        }

        sender_ids = {
            m.sender_user_id for m in latest_rows if m.sender_user_id
        }
        senders: dict[UUID, User] = {}
        if sender_ids:
            sender_rows = (
                await self.db.execute(
                    select(User).where(User.id.in_(sender_ids))
                )
            ).scalars().all()
            senders = {u.id: u for u in sender_rows}

        out: list[PatientNotificationOut] = []
        for conv in conv_rows:
            latest = latest_by_conv.get(conv.id)
            if latest is None or latest.sender_patient_id == patient_id:
                continue
            sender_name = None
            if latest.sender_user_id and latest.sender_user_id in senders:
                sender_name = senders[latest.sender_user_id].full_name
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
        # Batch-fetch every provider on these appointments in one IN
        # clause instead of one SELECT per row.
        provider_ids = {r.physician_id for r in rows if r.physician_id}
        providers: dict[UUID, User] = {}
        if provider_ids:
            prov_rows = (
                await self.db.execute(
                    select(User).where(User.id.in_(provider_ids))
                )
            ).scalars().all()
            providers = {u.id: u for u in prov_rows}

        out: list[PatientNotificationOut] = []
        for r in rows:
            provider_name = None
            if r.physician_id and r.physician_id in providers:
                provider_name = providers[r.physician_id].full_name
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
