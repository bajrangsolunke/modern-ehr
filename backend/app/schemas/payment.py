from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CashPaymentIn(BaseModel):
    """Front desk records a cash (or check / drawer) receipt."""

    invoice_id: UUID
    amount_cents: int = Field(gt=0)
    reference: str | None = Field(default=None, max_length=64)


class StripeInitIn(BaseModel):
    """Open a Stripe PaymentIntent for the current balance of an invoice."""

    invoice_id: UUID


class StripeInitOut(BaseModel):
    """What the patient-portal frontend needs to render the Payment
    Element — the client_secret is the auth token for THAT specific
    intent and is safe to expose to the patient's browser."""

    payment_intent_id: str
    client_secret: str
    publishable_key: str
    amount_cents: int


class PaymentOut(BaseModel):
    """Read projection of a payment row."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invoice_id: UUID
    patient_id: UUID
    method: str
    amount_cents: int
    status: str
    last4: str | None
    card_brand: str | None
    reference: str | None
    created_at: datetime
