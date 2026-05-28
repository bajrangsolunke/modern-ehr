"""Patient-scoped messaging schemas. Patient threads only — never
returns clinician-to-clinician conversations even if some lookup
accidentally reached them."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MessageOut(BaseModel):
    id: UUID
    conversation_id: UUID
    body: str
    urgent: bool
    sent_at: datetime
    sender_kind: str  # "patient" | "user"
    sender_name: str | None = None


class ConversationOut(BaseModel):
    id: UUID
    title: str | None = None
    last_message_at: datetime
    last_message_preview: str | None = None
    participants: list[str]
    unread: bool = False


class ConversationListOut(BaseModel):
    items: list[ConversationOut]


class ConversationDetailOut(BaseModel):
    id: UUID
    title: str | None = None
    participants: list[str]
    messages: list[MessageOut]
    # Highest staff `last_read_at` on the thread — patient-side
    # outgoing bubbles flip to ✓✓ for messages sent at/before this
    # timestamp. Null when no staff member has opened the thread yet.
    staff_last_read_at: datetime | None = None


class SendMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=8000)


class MarkReadIn(BaseModel):
    last_read_at: datetime | None = None
