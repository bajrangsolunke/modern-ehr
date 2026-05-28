"""NotificationService — single seam for in-app notifications.

Two entry points:
  * `dispatch()` — preferred. Typed kind + urgency + deep-link metadata.
    Other services call this when they trigger a notifiable event.
  * `create()` — legacy free-form. Kept for back-compat with the public
    REST POST endpoint.

Both paths persist a row AND broadcast a `notification.created` WS
event so the recipient's open clients tick their badge in real time.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.schemas.notification import (
    NotificationCreate,
    NotificationKind,
    NotificationUrgency,
)
from app.websockets.manager import ws_manager


class NotificationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ---------------------------------------------------------------- write

    async def dispatch(
        self,
        *,
        recipient_id: UUID,
        kind: NotificationKind,
        title: str,
        body: str | None = None,
        urgency: NotificationUrgency = "normal",
        related_type: str | None = None,
        related_id: UUID | None = None,
        link: str | None = None,
    ) -> Notification:
        """Persist + broadcast a typed notification. Preferred entry
        point — every notifiable trigger goes through here so the
        catalogue is centralized."""
        notif = Notification(
            user_id=recipient_id,
            kind=kind,
            urgency=urgency,
            title=title,
            body=body,
            related_type=related_type,
            related_id=related_id,
            link=link,
            # Mirror legacy fields so older list/filter code keeps working.
            severity=self._severity_from_urgency(urgency),
            source=kind,
        )
        self.db.add(notif)
        await self.db.flush()
        await self.db.refresh(notif)
        await self._broadcast(notif)
        return notif

    async def create(self, payload: NotificationCreate) -> Notification:
        """Legacy free-form create. Newer code should use `dispatch()`."""
        notif = Notification(
            kind="generic",
            urgency="normal",
            **payload.model_dump(),
        )
        self.db.add(notif)
        await self.db.flush()
        await self.db.refresh(notif)
        await self._broadcast(notif)
        return notif

    async def mark_read(self, notification_id: UUID) -> Notification | None:
        notif = await self.db.get(Notification, notification_id)
        if notif:
            notif.is_read = True
            await self.db.flush()
        return notif

    async def mark_all_read(self, user_id: UUID) -> int:
        """Bulk mark-read for the Topbar "Clear all" action. Returns
        the number of rows affected so the FE can confirm."""
        rows = (
            await self.db.execute(
                select(Notification).where(
                    Notification.user_id == user_id,
                    Notification.is_read.is_(False),
                )
            )
        ).scalars().all()
        for r in rows:
            r.is_read = True
        await self.db.flush()
        return len(rows)

    # ---------------------------------------------------------------- read

    async def list_for_user(
        self,
        user_id: UUID,
        *,
        only_unread: bool = False,
        limit: int = 50,
    ) -> list[Notification]:
        stmt = select(Notification).where(Notification.user_id == user_id)
        if only_unread:
            stmt = stmt.where(Notification.is_read.is_(False))
        stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def unread_count(self, user_id: UUID) -> int:
        return int(
            (
                await self.db.execute(
                    select(func.count(Notification.id)).where(
                        Notification.user_id == user_id,
                        Notification.is_read.is_(False),
                    )
                )
            ).scalar_one()
            or 0
        )

    # ---------------------------------------------------------------- helpers

    async def _broadcast(self, notif: Notification) -> None:
        payload = {
            "type": "notification.created",
            "notification": {
                "id": str(notif.id),
                "kind": notif.kind,
                "urgency": notif.urgency,
                "title": notif.title,
                "body": notif.body,
                "related_type": notif.related_type,
                "related_id": str(notif.related_id)
                if notif.related_id is not None
                else None,
                "link": notif.link,
                "created_at": notif.created_at.isoformat(),
                "is_read": notif.is_read,
            },
        }
        await ws_manager.send_to_user(str(notif.user_id), payload)

    @staticmethod
    def _severity_from_urgency(urgency: NotificationUrgency) -> str:
        # Back-compat mapping for older callers that filter by `severity`.
        return {
            "critical": "critical",
            "high": "warning",
            "normal": "info",
            "low": "info",
        }.get(urgency, "info")
