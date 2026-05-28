"""Patient-scoped synthetic notification feed.

The existing notifications table is keyed by staff user_id. For
patients we synthesize a feed by aggregating recent state changes
that are actually patient-relevant: new messages, upcoming
appointments, new documents, pending form requests.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


NotificationKind = Literal[
    "message", "appointment", "document", "form"
]


class PatientNotificationOut(BaseModel):
    id: str  # synthetic — "{kind}:{source_id}"
    kind: NotificationKind
    title: str
    body: str | None = None
    timestamp: datetime
    href: str | None = None


class PatientNotificationListOut(BaseModel):
    items: list[PatientNotificationOut]
    total: int
