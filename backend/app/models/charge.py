from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.invoice import Invoice
    from app.models.patient import Patient


class Charge(Base, UUIDMixin):
    __tablename__ = "charges"

    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    encounter_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("encounters.id", ondelete="SET NULL"), index=True
    )
    appointment_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("appointments.id", ondelete="SET NULL"), index=True
    )
    service_catalog_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("service_catalog.id", ondelete="SET NULL")
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tax_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    invoice_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("invoices.id", ondelete="RESTRICT"), index=True
    )
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    voided_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    patient: Mapped["Patient"] = relationship(back_populates="charges")
    invoice: Mapped["Invoice | None"] = relationship(back_populates="charges")
