"""DashboardService — aggregates the data behind the provider/admin
dashboard's right-rail cards.

Two responsibilities right now:
  * Requested tasks: the signed-in user's open assignments, ordered
    so the most urgent surfaces first (high priority → soonest due
    date → newest).
  * Latest message + unread total: drives the small "Latest message"
    strip under the requested-tasks card. Mirrors the patient-portal
    pattern (`PatientDashboardService._recent_message`) — pick the
    most recent conversation the viewer participates in, surface the
    last message preview, and report a global unread count for the
    inline badge.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, ConversationParticipant, Message
from app.models.patient import Patient
from app.models.task import Task, TaskPriority, TaskStatus, TaskType
from app.models.user import User
from app.schemas.dashboard import (
    DashboardLatestMessage,
    DashboardSnapshot,
    DashboardTaskOut,
)

# Right-rail glance card, not a full page. Users drill into /tasks
# for the full list.
_TASK_CARD_LIMIT = 5
_MESSAGE_PREVIEW_CHARS = 140


class DashboardService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ----------------------------------------------------------------

    async def snapshot(self, *, viewer_id: UUID) -> DashboardSnapshot:
        tasks, tasks_total = await self._requested_tasks(viewer_id)
        unread_total, latest = await self._messages(viewer_id)
        return DashboardSnapshot(
            requested_tasks=tasks,
            requested_tasks_total=tasks_total,
            unread_messages_count=unread_total,
            latest_message=latest,
        )

    # ----------------------------------------------------------------

    async def _requested_tasks(
        self, viewer_id: UUID
    ) -> tuple[list[DashboardTaskOut], int]:
        """Return (preview rows, total open count) for the viewer."""
        open_filter = (
            Task.assigned_to_user_id == viewer_id,
            Task.status.in_([TaskStatus.new, TaskStatus.in_progress]),
        )

        # Most urgent first: HIGH > MEDIUM > LOW, then soonest due (nulls
        # last), then newest. Explicit CASE so the ordering doesn't
        # depend on the alphabetic order of the enum values.
        priority_rank = case(
            (Task.priority == TaskPriority.high, 1),
            (Task.priority == TaskPriority.medium, 2),
            (Task.priority == TaskPriority.low, 3),
            else_=99,
        )

        stmt = (
            select(Task)
            .where(*open_filter)
            .order_by(
                priority_rank.asc(),
                Task.due_date.is_(None),  # non-null due dates first
                Task.due_date.asc(),
                Task.created_at.desc(),
            )
            .limit(_TASK_CARD_LIMIT)
        )
        rows = (await self.db.execute(stmt)).scalars().all()

        count_stmt = select(func.count(Task.id)).where(*open_filter)
        total = int((await self.db.execute(count_stmt)).scalar_one() or 0)

        # Bulk-resolve patient names so we don't N+1 the patient table.
        patient_ids = [t.patient_id for t in rows if t.patient_id is not None]
        patient_names: dict[UUID, str] = {}
        if patient_ids:
            name_rows = (
                await self.db.execute(
                    select(Patient.id, Patient.first_name, Patient.last_name).where(
                        Patient.id.in_(patient_ids)
                    )
                )
            ).all()
            patient_names = {
                pid: f"{first} {last}".strip()
                for pid, first, last in name_rows
            }

        items = [
            DashboardTaskOut(
                id=t.id,
                title=t.title,
                priority=t.priority.value,
                status=t.status.value,
                task_type=t.task_type.value,
                due_date=t.due_date,
                patient_id=t.patient_id,
                patient_name=patient_names.get(t.patient_id) if t.patient_id else None,
                created_at=t.created_at,
            )
            for t in rows
        ]
        return items, total

    # ----------------------------------------------------------------

    async def _messages(
        self, viewer_id: UUID
    ) -> tuple[int, DashboardLatestMessage | None]:
        """Return (unread total, latest message) for the viewer.

        Visibility now matches `MessagesService.list_conversations`:
        viewer must have a `ConversationParticipant` row, for BOTH
        clinician and patient threads. Patient threads are no longer
        the whole-team queue — each (staff, patient) pair has its
        own private thread.

        Latest = most recent message in any visible conversation,
        independent of read state. Mirrors the patient-portal's
        `_recent_message` so the strip keeps showing context even
        when the viewer has everything read.

        Unread total = messages since each participant row's
        `last_read_at`, excluding the viewer's own messages.
        """
        participant_rows = (
            await self.db.execute(
                select(ConversationParticipant).where(
                    ConversationParticipant.user_id == viewer_id
                )
            )
        ).scalars().all()

        if not participant_rows:
            return 0, None

        visible_ids = {p.conversation_id for p in participant_rows}
        last_read_by_conv = {
            p.conversation_id: p.last_read_at for p in participant_rows
        }

        # Unread total across the visible set. For conversations the
        # viewer participates in we honor `last_read_at`; for patient
        # conversations without a participant row we count every
        # non-self message (the viewer has never opened it).
        unread_total = 0
        for conv_id in visible_ids:
            last_read = last_read_by_conv.get(conv_id)
            unread_stmt = select(func.count(Message.id)).where(
                Message.conversation_id == conv_id,
                Message.sender_user_id != viewer_id,
            )
            if last_read is not None:
                unread_stmt = unread_stmt.where(Message.sent_at > last_read)
            unread_total += int(
                (await self.db.execute(unread_stmt)).scalar_one() or 0
            )

        # Latest conversation by last_message_at (denormalized column).
        latest_conv = (
            await self.db.execute(
                select(Conversation)
                .where(Conversation.id.in_(visible_ids))
                .order_by(Conversation.last_message_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if latest_conv is None or not latest_conv.last_message_preview:
            return unread_total, None

        # Resolve the sender display name via the latest Message row,
        # since `last_message_preview` doesn't carry sender identity.
        latest_msg = (
            await self.db.execute(
                select(Message)
                .where(Message.conversation_id == latest_conv.id)
                .order_by(Message.sent_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        sender_name: str | None = None
        if latest_msg is not None:
            if latest_msg.sender_user_id is not None:
                sender = await self.db.get(User, latest_msg.sender_user_id)
                if sender is not None:
                    sender_name = sender.full_name or sender.email
            elif latest_msg.sender_patient_id is not None:
                p = await self.db.get(Patient, latest_msg.sender_patient_id)
                if p is not None:
                    sender_name = f"{p.first_name} {p.last_name}".strip()

        preview = (latest_conv.last_message_preview or "").strip().replace("\n", " ")
        if len(preview) > _MESSAGE_PREVIEW_CHARS:
            preview = preview[: _MESSAGE_PREVIEW_CHARS - 1].rstrip() + "…"

        return unread_total, DashboardLatestMessage(
            conversation_id=latest_conv.id,
            sender_name=sender_name,
            preview=preview,
            sent_at=latest_conv.last_message_at,
        )
