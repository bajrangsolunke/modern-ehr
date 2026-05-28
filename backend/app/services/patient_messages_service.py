"""Patient-facing messaging. Only conversations where the patient is
the audience target are visible; sends always come from the patient.
Staff-to-staff threads are unreachable from this surface even if a
conversation id leaks."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import (
    Conversation,
    ConversationParticipant,
    Message,
)
from app.models.user import User
from app.schemas.patient_portal_messages import (
    ConversationDetailOut,
    ConversationListOut,
    ConversationOut,
    MessageOut,
)
from app.websockets.manager import ws_manager


class PatientMessagesService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _participants_names(self, conv_id: UUID) -> list[str]:
        rows = (
            await self.db.execute(
                select(User)
                .join(
                    ConversationParticipant,
                    ConversationParticipant.user_id == User.id,
                )
                .where(ConversationParticipant.conversation_id == conv_id)
            )
        ).scalars().all()
        return [u.full_name for u in rows]

    async def list_for_patient(self, patient_id: UUID) -> ConversationListOut:
        rows = (
            await self.db.execute(
                select(Conversation)
                .where(
                    Conversation.audience == "patient",
                    Conversation.patient_id == patient_id,
                )
                .order_by(Conversation.last_message_at.desc())
            )
        ).scalars().all()

        items: list[ConversationOut] = []
        for conv in rows:
            names = await self._participants_names(conv.id)
            # Patient "unread" heuristic: the latest message is from a
            # staff user and it's newer than the patient's last view of
            # this conversation. We don't track last-read per patient
            # yet — keep it false until that lands.
            items.append(
                ConversationOut(
                    id=conv.id,
                    title=conv.title,
                    last_message_at=conv.last_message_at,
                    last_message_preview=conv.last_message_preview,
                    participants=names,
                    unread=False,
                )
            )
        return ConversationListOut(items=items)

    async def _own_conversation(
        self, conv_id: UUID, patient_id: UUID
    ) -> Conversation:
        conv = await self.db.get(Conversation, conv_id)
        if (
            conv is None
            or conv.audience != "patient"
            or conv.patient_id != patient_id
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        return conv

    async def get_detail(
        self, conv_id: UUID, patient_id: UUID
    ) -> ConversationDetailOut:
        conv = await self._own_conversation(conv_id, patient_id)
        msg_rows = (
            await self.db.execute(
                select(Message)
                .where(Message.conversation_id == conv.id)
                .order_by(Message.sent_at.asc())
            )
        ).scalars().all()

        user_ids = {m.sender_user_id for m in msg_rows if m.sender_user_id}
        users = {}
        if user_ids:
            user_rows = (
                await self.db.execute(
                    select(User).where(User.id.in_(user_ids))
                )
            ).scalars().all()
            users = {u.id: u for u in user_rows}

        messages: list[MessageOut] = []
        for m in msg_rows:
            if m.sender_patient_id == patient_id:
                kind, name = "patient", None
            elif m.sender_user_id is not None:
                kind = "user"
                user = users.get(m.sender_user_id)
                name = user.full_name if user else None
            else:
                kind, name = "user", None
            messages.append(
                MessageOut(
                    id=m.id,
                    conversation_id=conv.id,
                    body=m.body,
                    urgent=m.urgent,
                    sent_at=m.sent_at,
                    sender_kind=kind,
                    sender_name=name,
                )
            )
        return ConversationDetailOut(
            id=conv.id,
            title=conv.title,
            participants=await self._participants_names(conv.id),
            messages=messages,
        )

    async def send_message(
        self, conv_id: UUID, patient_id: UUID, body: str
    ) -> MessageOut:
        conv = await self._own_conversation(conv_id, patient_id)
        msg = Message(
            conversation_id=conv.id,
            sender_patient_id=patient_id,
            body=body.strip(),
            urgent=False,
        )
        self.db.add(msg)
        conv.last_message_at = datetime.now(timezone.utc)
        conv.last_message_preview = body.strip()[:240]
        await self.db.commit()
        await self.db.refresh(msg)

        # Fan out to every subscriber's WebSocket connection. Patient
        # conversations are visible to all active staff plus the
        # patient (keyed by patient UUID for multi-tab consistency).
        payload = {
            "type": "message.created",
            "conversation_id": str(conv.id),
            "message_id": str(msg.id),
            "sender_patient_id": str(patient_id),
            "ts": msg.sent_at.isoformat(),
        }
        subscriber_ids: set[UUID] = {patient_id}
        staff_rows = (
            await self.db.execute(
                select(User.id).where(User.is_active.is_(True))
            )
        ).scalars().all()
        subscriber_ids.update(staff_rows)
        for sub_id in subscriber_ids:
            await ws_manager.send_to_user(str(sub_id), payload)

        return MessageOut(
            id=msg.id,
            conversation_id=conv.id,
            body=msg.body,
            urgent=msg.urgent,
            sent_at=msg.sent_at,
            sender_kind="patient",
            sender_name=None,
        )
