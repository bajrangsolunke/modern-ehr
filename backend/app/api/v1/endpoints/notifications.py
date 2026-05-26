from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.notification import NotificationCreate, NotificationOut
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def mine(db: DbSession, current: CurrentUser, only_unread: bool = False) -> list[NotificationOut]:
    items = await NotificationService(db).list_for_user(current.id, only_unread=only_unread)
    return [NotificationOut.model_validate(i) for i in items]


@router.post("", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
async def create_notification(
    payload: NotificationCreate, db: DbSession, current: CurrentUser
) -> NotificationOut:
    notif = await NotificationService(db).create(payload)
    return NotificationOut.model_validate(notif)


@router.post("/{notification_id}/read", response_model=NotificationOut | None)
async def mark_read(
    notification_id: UUID, db: DbSession, current: CurrentUser
) -> NotificationOut | None:
    notif = await NotificationService(db).mark_read(notification_id)
    return NotificationOut.model_validate(notif) if notif else None
