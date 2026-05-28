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
        # Highest staff `last_read_at` — drives the patient-side
        # "staff has seen this" double-tick. We take the max so the
        # patient sees ✓✓ as soon as ANY clinician on the thread has
        # opened it.
        staff_read_rows = (
            await self.db.execute(
                select(ConversationParticipant.last_read_at).where(
                    ConversationParticipant.conversation_id == conv.id,
                    ConversationParticipant.last_read_at.is_not(None),
                )
            )
        ).scalars().all()
        staff_last_read_at = max(staff_read_rows, default=None)

        return ConversationDetailOut(
            id=conv.id,
            title=conv.title,
            participants=await self._participants_names(conv.id),
            messages=messages,
            staff_last_read_at=staff_last_read_at,
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

        # Fan out ONLY to the actual staff participants of this thread
        # + the patient themselves. Patient conversations are
        # per-(staff, patient) now, so the other team members on the
        # patient's care team have their OWN threads — they don't
        # receive this WS frame.
        payload = {
            "type": "message.created",
            "conversation_id": str(conv.id),
            "message_id": str(msg.id),
            "sender_patient_id": str(patient_id),
            "ts": msg.sent_at.isoformat(),
        }
        participant_ids = (
            await self.db.execute(
                select(ConversationParticipant.user_id).where(
                    ConversationParticipant.conversation_id == conv.id
                )
            )
        ).scalars().all()
        subscriber_ids: set[UUID] = {patient_id, *participant_ids}
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

    # ---------------------------------------------------------------- read

    async def mark_read(
        self, conv_id: UUID, patient_id: UUID, ts: datetime | None = None
    ) -> None:
        """Patient just opened the thread → bump `patient_last_read_at`
        and broadcast `conversation.read` so providers' outgoing
        bubbles flip to ✓✓."""
        conv = await self._own_conversation(conv_id, patient_id)
        when = ts or datetime.now(timezone.utc)
        conv.patient_last_read_at = when
        await self.db.commit()

        payload = {
            "type": "conversation.read",
            "conversation_id": str(conv.id),
            "user_id": str(patient_id),
            "sender_kind": "patient",
            "last_read_at": when.isoformat(),
        }
        # Fan out to participants of THIS thread only — same scope as
        # send_message. Other staff on the care team don't get this.
        participant_ids = (
            await self.db.execute(
                select(ConversationParticipant.user_id).where(
                    ConversationParticipant.conversation_id == conv.id
                )
            )
        ).scalars().all()
        for sub_id in {patient_id, *participant_ids}:
            await ws_manager.send_to_user(str(sub_id), payload)

    async def ping_typing(self, conv_id: UUID, patient_id: UUID) -> None:
        """Transient typing indicator. Doesn't write to the DB — just
        fans out the WS event with `sender_kind: "patient"` so other
        side can render '<Patient name> is typing'."""
        conv = await self._own_conversation(conv_id, patient_id)
        payload = {
            "type": "conversation.typing",
            "conversation_id": str(conv.id),
            "user_id": str(patient_id),
            "sender_kind": "patient",
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        # Only the participants on this specific thread — not every
        # active staff user (that's what was leaking conversations).
        participant_ids = (
            await self.db.execute(
                select(ConversationParticipant.user_id).where(
                    ConversationParticipant.conversation_id == conv.id
                )
            )
        ).scalars().all()
        for sub_id in participant_ids:
            await ws_manager.send_to_user(str(sub_id), payload)
