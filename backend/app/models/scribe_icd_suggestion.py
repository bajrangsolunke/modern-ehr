from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.scribe_session import ScribeSession


class ScribeIcdSuggestion(Base, UUIDMixin):
    """An ICD-10 code suggested by the LLM. is_validated reflects a
    lookup against `icd_catalog` — unknown codes are kept (not dropped)
    so the UI can surface a "AI suggested but not in catalog" warning
    rather than silently hiding them."""

    __tablename__ = "scribe_icd_suggestions"

    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("scribe_sessions.id", ondelete="CASCADE"), index=True
    )
    code: Mapped[str] = mapped_column(String(16), nullable=False)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reasoning: Mapped[str | None] = mapped_column(Text)
    is_validated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    accepted_by_user: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session: Mapped[ScribeSession] = relationship(back_populates="icd_suggestions")
