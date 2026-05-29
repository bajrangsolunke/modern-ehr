from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.invoice import Invoice
    from app.models.patient import Patient


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    check = "check"
    card_present = "card_present"
    stripe = "stripe"
    adjustment = "adjustment"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


class Payment(Base, UUIDMixin):
    __tablename__ = "payments"

    invoice_id: Mapped[UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    method: Mapped[str] = mapped_column(String(24), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    stripe_charge_id: Mapped[str | None] = mapped_column(String(128))
    last4: Mapped[str | None] = mapped_column(String(4))
    card_brand: Mapped[str | None] = mapped_column(String(16))
    reference: Mapped[str | None] = mapped_column(String(64))
    received_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")
    patient: Mapped["Patient"] = relationship(back_populates="payments")
