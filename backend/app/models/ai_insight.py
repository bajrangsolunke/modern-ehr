from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDMixin


class AiInsight(Base, UUIDMixin):
    __tablename__ = "ai_insights"

    patient_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    model: Mapped[str] = mapped_column(String(64), default="gpt-4o-mini")
    actions: Mapped[dict | None] = mapped_column(JSONB)
    # SHA-256 hex of the chart snapshot at the time of generation —
    # used by the cache layer to detect when the underlying data has
    # changed and a regen is needed. Indexed via composite index in
    # migration 0017.
    content_hash: Mapped[str | None] = mapped_column(String(64), index=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
