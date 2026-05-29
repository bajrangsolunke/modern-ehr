from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.charge import Charge
    from app.models.patient import Patient
    from app.models.payment import Payment


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    open = "open"
    partially_paid = "partially_paid"
    paid = "paid"
    void = "void"
    refunded = "refunded"


class Invoice(Base, UUIDMixin):
    __tablename__ = "invoices"

    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(24), default="draft", nullable=False, index=True)
    subtotal_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    discount_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tax_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    paid_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    balance_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    patient: Mapped["Patient"] = relationship(back_populates="invoices")
    charges: Mapped[list["Charge"]] = relationship(back_populates="invoice")
    payments: Mapped[list["Payment"]] = relationship(back_populates="invoice")
