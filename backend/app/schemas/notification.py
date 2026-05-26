from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationCreate(BaseModel):
    user_id: UUID
    title: str
    body: str | None = None
    severity: str = "info"
    source: str = "system"


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str
    body: str | None
    severity: str
    source: str
    is_read: bool
    created_at: datetime
