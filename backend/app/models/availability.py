from __future__ import annotations

from datetime import time
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class UserAvailability(Base, UUIDMixin, TimestampMixin):
    """
    A weekly availability slot for a user (typically a provider).
    `day_of_week` is 0–6 with 0 = Monday (ISO weekday convention, just
    minus 1 so the lookup table is 0-indexed). A user can have multiple
    slots per day to model split shifts (e.g. 09:00–12:00 + 14:00–17:00).
    """

    __tablename__ = "user_availability"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    note: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[User] = relationship()

    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="user_avail_dow_range"),
        CheckConstraint("end_time > start_time", name="user_avail_time_order"),
    )
