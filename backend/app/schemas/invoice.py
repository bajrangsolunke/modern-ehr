from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InvoiceIssueIn(BaseModel):
    """Issue a new invoice from a set of existing uninvoiced charges
    belonging to the same patient."""

    patient_id: UUID
    charge_ids: list[UUID] = Field(min_length=1)
    discount_cents: int = Field(default=0, ge=0)
    notes: str | None = None


class InvoiceOut(BaseModel):
    """Read projection of an invoice — money totals always reflect the
    last `recalc()` snapshot."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    number: str
    patient_id: UUID
    status: str
    subtotal_cents: int
    discount_cents: int
    tax_cents: int
    total_cents: int
    paid_cents: int
    balance_cents: int
    issued_at: datetime | None
    due_at: datetime | None
    notes: str | None
    created_at: datetime
