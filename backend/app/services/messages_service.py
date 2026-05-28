"""
Communication module service — owns all read/write paths for the
conversations + messages tables and broadcasts deltas through the
WebSocket manager so connected clients update in real time.

Visibility rules:
  * Clinician conversations are visible only to their participants.
  * Patient conversations are visible to every active staff user (any
    clinician can pick up a patient thread). This matches how nurses /
    coordinators triage inboxes in practice.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Iterable
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import (
    Conversation,
    ConversationParticipant,
    Message,
    MessageAttachment,
)
from app.models.document import Document
from app.models.patient import Patient
from app.models.user import User
from app.schemas.conversation import (
    AttachmentOut,
    ConversationOut,
    MessageOut,
    ParticipantOut,
    PatientSummary,
)
from app.websockets.manager import ws_manager


def _years_since(d: date) -> int:
    today = date.today()
    years = today.year - d.year
    if (today.month, today.day) < (d.month, d.day):
        years -= 1
    return max(0, years)


class MessagesService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ---------------------------------------------------------------- reads

    async def list_conversations(
        self,
        *,
        viewer_id: UUID,
        audience: str | None = None,
        q: str | None = None,
    ) -> list[ConversationOut]:
        # SQL-level filter — the conversation must have a
        # participant row for the viewer. Both clinician and patient
        # threads use the same rule now. Pushing this to the JOIN
        # (instead of a post-hoc Python filter) means the database
        # enforces the privacy boundary directly, and we never even
        # ship non-visible rows to the application layer.
        stmt = (
            select(Conversation)
            .join(
                ConversationParticipant,
                ConversationParticipant.conversation_id == Conversation.id,
            )
            .where(ConversationParticipant.user_id == viewer_id)
            .options(
                selectinload(Conversation.participants).selectinload(
                    ConversationParticipant.conversation
                ),
            )
            .order_by(Conversation.last_message_at.desc())
        )

        if audience:
            stmt = stmt.where(Conversation.audience == audience)

        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Conversation.last_message_preview.ilike(like),
                    Conversation.title.ilike(like),
                )
            )

        rows = (await self.db.execute(stmt)).scalars().unique().all()
        return [await self._project(c, viewer_id=viewer_id) for c in rows]

    async def get_conversation(
        self, conversation_id: UUID, *, viewer_id: UUID
    ) -> Conversation:
        conv = (
            await self.db.execute(
                select(Conversation)
                .options(
                    selectinload(Conversation.participants),
                    selectinload(Conversation.messages).selectinload(
                        Message.attachments
                    ),
                )
                .where(Conversation.id == conversation_id)
            )
        ).scalar_one_or_none()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        await self._authorize_read(conv, viewer_id=viewer_id)
        return conv

    async def list_messages(
        self, conversation_id: UUID, *, viewer_id: UUID
    ) -> list[Message]:
        conv = await self.get_conversation(conversation_id, viewer_id=viewer_id)
        return list(conv.messages)

    # ---------------------------------------------------------------- writes

    async def create_patient_conversation(
        self,
        *,
        viewer_id: UUID,
        patient_id: UUID,
        body: str,
        urgent: bool,
    ) -> tuple[Conversation, Message]:
        """Each (staff_user, patient) pair gets its OWN thread — we
        don't share patient conversations across the whole care team
        anymore. If the viewer already has a thread with this patient,
        we append to it; otherwise we create a new private one with
        the viewer added as the sole staff participant. The patient
        sees one row per provider on their portal feed."""
        patient = await self.db.get(Patient, patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        # Reuse the viewer's OWN thread with this patient if one
        # already exists. Threads belonging to other staff stay private.
        existing = (
            await self.db.execute(
                select(Conversation)
                .join(
                    ConversationParticipant,
                    ConversationParticipant.conversation_id == Conversation.id,
                )
                .where(
                    Conversation.audience == "patient",
                    Conversation.patient_id == patient_id,
                    ConversationParticipant.user_id == viewer_id,
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if existing:
            return existing, await self.append_message(
                existing.id, viewer_id=viewer_id, body=body, urgent=urgent
            )

        conv = Conversation(
            audience="patient",
            patient_id=patient_id,
            title=f"{patient.first_name} {patient.last_name}".strip(),
        )
        self.db.add(conv)
        await self.db.flush()
        # The viewer becomes the only staff participant — gives us the
        # same visibility/typing/read mechanics as clinician threads.
        self.db.add(
            ConversationParticipant(conversation_id=conv.id, user_id=viewer_id)
        )
        await self.db.flush()
        msg = await self.append_message(
            conv.id, viewer_id=viewer_id, body=body, urgent=urgent
        )
        return conv, msg

    async def create_clinician_conversation(
        self,
        *,
        viewer_id: UUID,
        user_ids: Iterable[UUID],
        body: str,
        urgent: bool,
    ) -> tuple[Conversation, Message]:
        unique_ids = {viewer_id, *user_ids}
        if len(unique_ids) < 2:
            raise HTTPException(
                status_code=400,
                detail="Need at least one other participant.",
            )

        # Confirm all participants exist.
        rows = (
            await self.db.execute(select(User).where(User.id.in_(unique_ids)))
        ).scalars().all()
        if len(rows) != len(unique_ids):
            raise HTTPException(status_code=400, detail="Unknown participant.")

        # Try to reuse an exact-match thread (same participant set).
        candidate_ids = (
            await self.db.execute(
                select(ConversationParticipant.conversation_id)
                .where(ConversationParticipant.user_id == viewer_id)
            )
        ).scalars().all()
        for conv_id in candidate_ids:
            conv = (
                await self.db.execute(
                    select(Conversation)
                    .options(selectinload(Conversation.participants))
                    .where(Conversation.id == conv_id, Conversation.audience == "clinician")
                )
            ).scalar_one_or_none()
            if conv is None:
                continue
            participant_ids = {p.user_id for p in conv.participants}
            if participant_ids == unique_ids:
                return conv, await self.append_message(
                    conv.id, viewer_id=viewer_id, body=body, urgent=urgent
                )

        conv = Conversation(audience="clinician", title=None)
        self.db.add(conv)
        await self.db.flush()
        for uid in unique_ids:
            self.db.add(
                ConversationParticipant(conversation_id=conv.id, user_id=uid)
            )
        await self.db.flush()
        msg = await self.append_message(
            conv.id, viewer_id=viewer_id, body=body, urgent=urgent
        )
        return conv, msg

    async def append_message(
        self,
        conversation_id: UUID,
        *,
        viewer_id: UUID,
        body: str,
        urgent: bool,
        document_ids: list[UUID] | None = None,
    ) -> Message:
        conv = await self.get_conversation(conversation_id, viewer_id=viewer_id)

        msg = Message(
            conversation_id=conv.id,
            sender_user_id=viewer_id,
            body=body,
            urgent=urgent,
        )
        self.db.add(msg)
        await self.db.flush()  # populate msg.id for FK

        if document_ids:
            await self._attach_documents(msg, document_ids, conv=conv)

        # Surface a richer preview when there's an attachment but no body.
        preview = body or (
            "📎 Document" if document_ids else ""
        )
        conv.last_message_preview = preview[:280]
        conv.last_message_at = datetime.now(timezone.utc)
        await self.db.flush()

        # Re-load with attachments + their documents so the broadcast
        # frame carries everything the FE needs.
        loaded = (
            await self.db.execute(
                select(Message)
                .options(
                    selectinload(Message.attachments).selectinload(
                        MessageAttachment.message
                    ),
                )
                .where(Message.id == msg.id)
            )
        ).scalar_one()

        await self._broadcast_message(conv, loaded)
        return loaded

    async def _attach_documents(
        self,
        msg: Message,
        document_ids: list[UUID],
        *,
        conv: Conversation,
    ) -> None:
        """Validate document references + create the join rows.

        For patient threads, every attached document must already
        belong to that patient — prevents cross-patient leaks.
        """
        if not document_ids:
            return
        docs = (
            await self.db.execute(
                select(Document).where(Document.id.in_(document_ids))
            )
        ).scalars().all()
        if len(docs) != len(set(document_ids)):
            raise HTTPException(status_code=404, detail="Document not found")

        if conv.audience == "patient" and conv.patient_id is not None:
            for d in docs:
                if d.patient_id != conv.patient_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Document does not belong to this patient.",
                    )
        else:
            # Clinician threads don't carry a patient_id; attaching cross-
            # patient docs there can leak PHI to staff who aren't on the
            # patient's care team. Block until we model that explicitly.
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attachments are only supported on patient threads today.",
            )

        for d in docs:
            self.db.add(
                MessageAttachment(message_id=msg.id, document_id=d.id)
            )
        await self.db.flush()

    async def ping_typing(
        self, conversation_id: UUID, *, viewer_id: UUID
    ) -> None:
        """Broadcast a typing event to other participants.

        Doesn't write anything to the DB — typing is purely transient
        UI state. The endpoint exists so the FE can use the standard
        REST + auth pipe instead of inventing a separate client-to-
        server WS protocol.
        """
        conv = await self.get_conversation(conversation_id, viewer_id=viewer_id)
        payload = {
            "type": "conversation.typing",
            "conversation_id": str(conversation_id),
            "user_id": str(viewer_id),
            # Always "user" here — provider/staff typing. Patient typing
            # goes through PatientMessagesService.ping_typing and emits
            # sender_kind: "patient" so the FE can render a different
            # display name.
            "sender_kind": "user",
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        for user_id in await self._subscriber_ids(conv):
            if user_id == viewer_id:
                continue  # don't echo to the sender
            await ws_manager.send_to_user(str(user_id), payload)

    async def mark_read(
        self, conversation_id: UUID, *, viewer_id: UUID, ts: datetime | None = None
    ) -> None:
        # `get_conversation` already enforces participation via
        # `_authorize_read` — by the time we reach the row update the
        # viewer must already be a ConversationParticipant. We removed
        # the old "auto-insert if missing" branch deliberately: it
        # silently granted a non-participant access to the thread
        # they were trying to mark read, which is exactly the leak we
        # just sealed at the read paths.
        conv = await self.get_conversation(conversation_id, viewer_id=viewer_id)
        row = (
            await self.db.execute(
                select(ConversationParticipant).where(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == viewer_id,
                )
            )
        ).scalar_one_or_none()
        when = ts or datetime.now(timezone.utc)
        if row is None:
            # Should be unreachable after _authorize_read; defensive
            # raise so a silent bypass is loud instead of quiet.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a participant in this conversation.",
            )
        row.last_read_at = when
        await self.db.flush()

        # Tell everyone in the thread so their outgoing bubbles can
        # flip to "read".
        payload = {
            "type": "conversation.read",
            "conversation_id": str(conversation_id),
            "user_id": str(viewer_id),
            "sender_kind": "user",
            "last_read_at": when.isoformat(),
        }
        for user_id in await self._subscriber_ids(conv):
            await ws_manager.send_to_user(str(user_id), payload)

    # ------------------------------------------------------------ broadcast

    async def _broadcast_message(self, conv: Conversation, msg: Message) -> None:
        projected = await self._project_message(msg)
        payload = {
            "type": "message.created",
            "conversation_id": str(conv.id),
            "message": projected.model_dump(mode="json"),
        }
        subscribers = await self._subscriber_ids(conv)
        for user_id in subscribers:
            await ws_manager.send_to_user(str(user_id), payload)

        # Fan out a `new_message` notification too. Recipients =
        # every staff subscriber except the sender. Patients aren't
        # in the User table so they're naturally excluded from the
        # notification persistence — their feed comes from the
        # patient_notifications_service.
        await self._notify_new_message(conv, msg, subscribers)

    async def _notify_new_message(
        self,
        conv: Conversation,
        msg: Message,
        subscribers: Iterable[UUID],
    ) -> None:
        from app.services.notification_service import NotificationService

        sender_name: str = "Patient" if msg.sender_patient_id else "Care team"
        if msg.sender_user_id is not None:
            u = await self.db.get(User, msg.sender_user_id)
            if u is not None:
                sender_name = u.full_name or u.email
        elif msg.sender_patient_id is not None:
            from app.models.patient import Patient

            p = await self.db.get(Patient, msg.sender_patient_id)
            if p is not None:
                sender_name = f"{p.first_name} {p.last_name}".strip()

        # Truncate preview the same way the conversation's
        # last_message_preview is truncated.
        preview = (msg.body or "").strip().replace("\n", " ")
        if len(preview) > 140:
            preview = preview[:139].rstrip() + "…"
        link = f"/messages?conversation={conv.id}"
        urgency = "high" if msg.urgent else "normal"

        notif_svc = NotificationService(self.db)
        for sub_id in subscribers:
            # Don't notify the sender of their own message.
            if msg.sender_user_id is not None and sub_id == msg.sender_user_id:
                continue
            # Skip the patient — they get notified via the patient
            # portal's feed-based service, not the User-keyed table.
            if (
                conv.patient_id is not None
                and sub_id == conv.patient_id
            ):
                continue
            await notif_svc.dispatch(
                recipient_id=sub_id,
                kind="new_message",
                urgency=urgency,
                title=f"New message from {sender_name}",
                body=preview or None,
                related_type="conversation",
                related_id=conv.id,
                link=link,
            )

    async def _project_message(self, msg: Message) -> MessageOut:
        """Build the MessageOut payload — including the attached
        document metadata for each MessageAttachment row."""
        attachments_out: list[AttachmentOut] = []
        if msg.attachments:
            doc_ids = [a.document_id for a in msg.attachments]
            docs = (
                await self.db.execute(
                    select(Document).where(Document.id.in_(doc_ids))
                )
            ).scalars().all()
            docs_by_id = {d.id: d for d in docs}
            for a in msg.attachments:
                d = docs_by_id.get(a.document_id)
                if not d:
                    continue
                attachments_out.append(
                    AttachmentOut(
                        id=d.id,
                        name=d.name,
                        mime_type=d.mime_type,
                        size_bytes=d.size_bytes,
                        category=d.category,
                        has_preview=bool(d.extracted_text),
                    )
                )

        return MessageOut(
            id=msg.id,
            conversation_id=msg.conversation_id,
            sender_user_id=msg.sender_user_id,
            sender_patient_id=msg.sender_patient_id,
            body=msg.body,
            urgent=msg.urgent,
            sent_at=msg.sent_at,
            attachments=attachments_out,
        )

    async def _subscriber_ids(self, conv: Conversation) -> set[UUID]:
        """Who receives WS broadcasts (message/typing/read) for this
        conversation. ONLY the actual staff participants + the
        patient (for patient threads). Previously this fanned out to
        every active staff user, which leaked patient threads across
        the team."""
        ids: set[UUID] = {p.user_id for p in conv.participants}
        if conv.audience == "patient" and conv.patient_id is not None:
            ids.add(conv.patient_id)
        return ids

    # ---------------------------------------------------------------- helpers

    async def _authorize_read(
        self, conv: Conversation, *, viewer_id: UUID
    ) -> None:
        """Same rule for clinician + patient threads now — viewer must
        be in `participants`. Stops a leaked conversation_id from
        being readable by a non-member of the thread."""
        if not any(p.user_id == viewer_id for p in conv.participants):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a participant in this conversation.",
            )

    async def _project(
        self, conv: Conversation, *, viewer_id: UUID
    ) -> ConversationOut:
        patient_summary: PatientSummary | None = None
        if conv.patient_id is not None:
            patient = await self.db.get(Patient, conv.patient_id)
            if patient is not None:
                patient_summary = PatientSummary(
                    id=patient.id,
                    name=f"{patient.first_name} {patient.last_name}".strip(),
                    mrn=patient.mrn,
                    dob=patient.dob.isoformat() if patient.dob else None,
                    age=_years_since(patient.dob) if patient.dob else None,
                    gender=patient.sex,
                    phone=patient.phone,
                    email=patient.email,
                    avatar_url=patient.avatar_url,
                    condition_tag=patient.condition_tag,
                )

        # Project participants → users, with each participant's
        # last_read_at attached so the FE can compute read receipts.
        participants_out: list[ParticipantOut] = []
        if conv.participants:
            user_ids = [p.user_id for p in conv.participants]
            users = (
                await self.db.execute(select(User).where(User.id.in_(user_ids)))
            ).scalars().all()
            read_by_user = {p.user_id: p.last_read_at for p in conv.participants}
            participants_out = [
                ParticipantOut(
                    id=u.id,
                    name=u.full_name or u.email,
                    email=u.email,
                    role=str(u.role.value) if u.role else None,
                    specialty=u.specialty,
                    avatar_url=u.avatar_url,
                    last_read_at=read_by_user.get(u.id),
                )
                for u in users
            ]

        unread = await self._unread_count(conv, viewer_id=viewer_id)

        return ConversationOut(
            id=conv.id,
            audience=conv.audience,
            title=conv.title,
            last_message_at=conv.last_message_at,
            last_message_preview=conv.last_message_preview,
            unread=unread,
            patient=patient_summary,
            participants=participants_out,
            patient_last_read_at=conv.patient_last_read_at,
        )

    async def _unread_count(
        self, conv: Conversation, *, viewer_id: UUID
    ) -> int:
        row = (
            await self.db.execute(
                select(ConversationParticipant).where(
                    ConversationParticipant.conversation_id == conv.id,
                    ConversationParticipant.user_id == viewer_id,
                )
            )
        ).scalar_one_or_none()
        last_read = row.last_read_at if row else None

        stmt = select(func.count(Message.id)).where(
            Message.conversation_id == conv.id,
            # Don't count the viewer's own messages as unread.
            Message.sender_user_id != viewer_id,
        )
        if last_read is not None:
            stmt = stmt.where(Message.sent_at > last_read)
        return int((await self.db.execute(stmt)).scalar_one() or 0)
