"""DashboardService — aggregates the data behind the provider/admin
dashboard's right-rail cards.

Two responsibilities right now:
  * Requested tasks: the signed-in user's open assignments, ordered
    so the most urgent surfaces first (high priority → soonest due
    date → newest).
  * Unread messages: a per-viewer summary across all their
    conversations — total unread count + a small preview list of the
    most recent conversations with unread activity.

The two are queried separately so a slow message query never holds
up the task card and vice versa; we run them concurrently in the
endpoint via `asyncio.gather`.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import Conversation, ConversationParticipant, Message
from app.models.patient import Patient
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User
from app.schemas.dashboard import (
    DashboardMessageOut,
    DashboardSnapshot,
    DashboardTaskOut,
)

# Keep both lists short — these are right-rail glance cards, not full
# pages. Users drill into /tasks or /messages for the full view.
_TASK_CARD_LIMIT = 5
_MESSAGE_CARD_LIMIT = 3
_MESSAGE_PREVIEW_CHARS = 120


class DashboardService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ----------------------------------------------------------------

    async def snapshot(self, *, viewer_id: UUID) -> DashboardSnapshot:
        tasks, tasks_total = await self._requested_tasks(viewer_id)
        unread_total, unread_rows = await self._unread_messages(viewer_id)
        return DashboardSnapshot(
            requested_tasks=tasks,
            requested_tasks_total=tasks_total,
            unread_messages_count=unread_total,
            recent_unread_messages=unread_rows,
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

    async def _unread_messages(
        self, viewer_id: UUID
    ) -> tuple[int, list[DashboardMessageOut]]:
        """Sum unread across the viewer's conversations + return the
        top N conversations by most-recent unread message."""
        participants = (
            await self.db.execute(
                select(ConversationParticipant)
                .where(ConversationParticipant.user_id == viewer_id)
                .options(
                    selectinload(ConversationParticipant.conversation).selectinload(
                        Conversation.participants
                    )
                )
            )
        ).scalars().all()

        if not participants:
            return 0, []

        # Compute unread per conversation + grab the most-recent unread
        # message for the preview. Single query per conversation keeps
        # the math obvious; small N (rarely > a few dozen) so the loop
        # is fine. If this grows, switch to a windowed CTE.
        unread_per_conv: list[tuple[ConversationParticipant, int, Message | None]] = []
        for part in participants:
            unread_stmt = select(func.count(Message.id)).where(
                Message.conversation_id == part.conversation_id,
                Message.sender_user_id != viewer_id,
            )
            if part.last_read_at is not None:
                unread_stmt = unread_stmt.where(Message.sent_at > part.last_read_at)
            unread_count = int(
                (await self.db.execute(unread_stmt)).scalar_one() or 0
            )
            if unread_count == 0:
                continue

            latest_stmt = (
                select(Message)
                .where(
                    Message.conversation_id == part.conversation_id,
                    Message.sender_user_id != viewer_id,
                )
                .order_by(Message.sent_at.desc())
                .limit(1)
            )
            if part.last_read_at is not None:
                latest_stmt = latest_stmt.where(Message.sent_at > part.last_read_at)
            latest = (await self.db.execute(latest_stmt)).scalar_one_or_none()
            unread_per_conv.append((part, unread_count, latest))

        total = sum(c for _, c, _ in unread_per_conv)

        # Sort by most-recent unread, then unread count as tie-breaker.
        unread_per_conv.sort(
            key=lambda triple: (
                triple[2].sent_at if triple[2] else None,
                triple[1],
            ),
            reverse=True,
        )

        # Bulk-resolve sender display names — usually a small set.
        sender_ids: set[UUID] = set()
        sender_patient_ids: set[UUID] = set()
        for _, _, msg in unread_per_conv[:_MESSAGE_CARD_LIMIT]:
            if msg is None:
                continue
            if msg.sender_user_id is not None:
                sender_ids.add(msg.sender_user_id)
            elif msg.sender_patient_id is not None:
                sender_patient_ids.add(msg.sender_patient_id)

        user_names: dict[UUID, str] = {}
        if sender_ids:
            rows = (
                await self.db.execute(
                    select(User.id, User.first_name, User.last_name).where(
                        User.id.in_(sender_ids)
                    )
                )
            ).all()
            user_names = {
                uid: f"{first} {last}".strip() for uid, first, last in rows
            }
        patient_names: dict[UUID, str] = {}
        if sender_patient_ids:
            rows = (
                await self.db.execute(
                    select(Patient.id, Patient.first_name, Patient.last_name).where(
                        Patient.id.in_(sender_patient_ids)
                    )
                )
            ).all()
            patient_names = {
                pid: f"{first} {last}".strip() for pid, first, last in rows
            }

        preview: list[DashboardMessageOut] = []
        for part, unread_count, msg in unread_per_conv[:_MESSAGE_CARD_LIMIT]:
            if msg is None:
                continue
            if msg.sender_user_id is not None:
                sender_name = user_names.get(msg.sender_user_id, "Unknown user")
            elif msg.sender_patient_id is not None:
                sender_name = patient_names.get(msg.sender_patient_id, "Unknown patient")
            else:
                sender_name = "System"
            body = (msg.body or "").strip().replace("\n", " ")
            if len(body) > _MESSAGE_PREVIEW_CHARS:
                body = body[: _MESSAGE_PREVIEW_CHARS - 1].rstrip() + "…"
            preview.append(
                DashboardMessageOut(
                    conversation_id=part.conversation_id,
                    sender_name=sender_name,
                    preview=body,
                    sent_at=msg.sent_at,
                    unread_count=unread_count,
                )
            )
        return total, preview
