from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.schemas.notification import NotificationCreate
from app.websockets.manager import ws_manager


class NotificationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, payload: NotificationCreate) -> Notification:
        notif = Notification(**payload.model_dump())
        self.db.add(notif)
        await self.db.flush()
        await self.db.refresh(notif)
        await ws_manager.send_to_user(
            str(notif.user_id),
            {
                "type": "notification",
                "id": str(notif.id),
                "title": notif.title,
                "body": notif.body,
                "severity": notif.severity,
            },
        )
        return notif

    async def list_for_user(self, user_id: UUID, only_unread: bool = False) -> list[Notification]:
        stmt = select(Notification).where(Notification.user_id == user_id)
        if only_unread:
            stmt = stmt.where(Notification.is_read.is_(False))
        stmt = stmt.order_by(Notification.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def mark_read(self, notification_id: UUID) -> Notification | None:
        notif = await self.db.get(Notification, notification_id)
        if notif:
            notif.is_read = True
            await self.db.flush()
        return notif
