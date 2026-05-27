"""
Form request workflow — US-FORM-1..8.

A single `form_requests` row encodes the full lifecycle:
  pending (just requested)
    → submitted (filled in)
      → completed (approved by reviewer)
      → denied (rejected by reviewer, with `review_notes`)

The form payload itself lives in `data` (JSONB). The shape is
validated per `form_type` at the Pydantic layer — keeping the column
flexible avoids six near-empty tables, while typed write paths give
us schema safety where it matters.
"""
from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class FormType(str, enum.Enum):
    consent = "consent"
    intake = "intake"
    roi = "roi"
    insurance = "insurance"
    discharge = "discharge"
    referral = "referral"


class FormRequestStatus(str, enum.Enum):
    pending = "pending"
    submitted = "submitted"
    completed = "completed"
    denied = "denied"


class FormRequest(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "form_requests"

    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    form_type: Mapped[FormType] = mapped_column(
        Enum(FormType, name="form_type"), nullable=False, index=True
    )
    status: Mapped[FormRequestStatus] = mapped_column(
        Enum(FormRequestStatus, name="form_request_status"),
        default=FormRequestStatus.pending,
        nullable=False,
        index=True,
    )

    requested_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column(Date, index=True)

    data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    review_notes: Mapped[str | None] = mapped_column(Text)

    # Optional link back to the auto-generated task — lets us close it
    # when the form completes / gets denied.
    task_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True
    )
