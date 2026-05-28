from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDMixin


class Notification(Base, UUIDMixin):
    __tablename__ = "notifications"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    # Discriminator the FE switches on for icon + copy. See
    # `NotificationKind` in app.schemas.notification for the full set.
    kind: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    # critical | high | normal | low — drives badge color + OS toast.
    urgency: Mapped[str] = mapped_column(String(16), nullable=False, default="normal")
    # Optional pointer to the source row that triggered this notification.
    # `related_type` is a string tag ("task", "appointment", "form_request",
    # "conversation", "patient", "lab_result", ...) so we don't need a real
    # polymorphic FK; the FE doesn't join, it just deep-links via `link`.
    related_type: Mapped[str | None] = mapped_column(String(48))
    related_id: Mapped[UUID | None]
    # Frontend route to deep-link to when the user clicks the notification.
    link: Mapped[str | None] = mapped_column(String(512))
    # Legacy fields kept for back-compat with the older free-form
    # NotificationService.create(); new code uses kind/urgency above.
    severity: Mapped[str] = mapped_column(String(16), default="info")
    source: Mapped[str] = mapped_column(String(32), default="system")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
