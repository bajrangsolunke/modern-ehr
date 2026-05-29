from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations import stripe_client
from app.models.invoice import Invoice
from app.models.patient import Patient
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.schemas.payment import (
    CashPaymentIn,
    PaymentOut,
    StripeInitIn,
    StripeInitOut,
)
from app.services.audit_service import AuditService
from app.services.invoice_service import InvoiceService


class PaymentService:
    """Cash + Stripe-init payment flows.

    Cash is fully synchronous: write a `succeeded` row, call
    `InvoiceService.recalc()`, done.

    Stripe init only OPENS the intent: a `pending` row is written
    keyed by the Stripe `payment_intent_id`. The webhook handler in
    T9 is the source of truth for flipping it to `succeeded`."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _load_locked_invoice(self, invoice_id: UUID) -> Invoice:
        """Row-lock the invoice for the lifetime of this transaction
        so balance checks + payment writes serialize cleanly."""
        inv = (
            await self.db.execute(
                select(Invoice)
                .where(Invoice.id == invoice_id)
                .with_for_update()
            )
        ).scalar_one_or_none()
        if inv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
            )
        if inv.status in {"void", "refunded"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Invoice is {inv.status}",
            )
        return inv

    async def record_cash(
        self, payload: CashPaymentIn, *, viewer_id: UUID
    ) -> PaymentOut:
        """Take a cash (or check / adjustment) receipt at the desk."""
        inv = await self._load_locked_invoice(payload.invoice_id)
        if payload.amount_cents > inv.balance_cents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Amount {payload.amount_cents} exceeds balance {inv.balance_cents}"
                ),
            )

        row = Payment(
            invoice_id=inv.id,
            patient_id=inv.patient_id,
            method=PaymentMethod.cash.value,
            amount_cents=payload.amount_cents,
            status=PaymentStatus.succeeded.value,
            reference=payload.reference,
            received_by_user_id=viewer_id,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(row)
        await self.db.flush()
        # Same transaction → caller sees the new totals immediately.
        await InvoiceService(self.db).recalc(inv.id)
        await self.db.refresh(row)
        await AuditService(self.db).record(
            user_id=viewer_id,
            action="payment.cash",
            resource_type="payment",
            resource_id=str(row.id),
            payload={
                "invoice_id": str(inv.id),
                "amount_cents": row.amount_cents,
            },
        )
        return PaymentOut.model_validate(row)

    async def init_stripe(self, payload: StripeInitIn) -> StripeInitOut:
        """Open a Stripe PaymentIntent for the current balance."""
        inv = await self._load_locked_invoice(payload.invoice_id)
        if inv.balance_cents <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invoice has no balance",
            )

        patient = await self.db.get(Patient, inv.patient_id)
        if patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found",
            )

        customer_id = await stripe_client.ensure_customer(
            patient_id=str(patient.id),
            name=f"{patient.first_name} {patient.last_name}".strip(),
            email=patient.email,
            existing_customer_id=patient.stripe_customer_id,
        )
        if patient.stripe_customer_id is None:
            patient.stripe_customer_id = customer_id
            await self.db.flush()

        intent = await stripe_client.create_payment_intent(
            invoice_id=str(inv.id),
            customer_id=customer_id,
            amount_cents=inv.balance_cents,
            description=f"Invoice {inv.number}",
        )

        # Idempotency: Stripe returns the SAME PaymentIntent on retry
        # (because of `pi:{invoice_id}` key). If we already have a row
        # for it, return the existing one rather than re-INSERTing
        # (which would violate the UNIQUE constraint on
        # stripe_payment_intent_id).
        existing = (
            await self.db.execute(
                select(Payment).where(
                    Payment.stripe_payment_intent_id == intent["id"]
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            self.db.add(
                Payment(
                    invoice_id=inv.id,
                    patient_id=inv.patient_id,
                    method=PaymentMethod.stripe.value,
                    amount_cents=inv.balance_cents,
                    status=PaymentStatus.pending.value,
                    stripe_payment_intent_id=intent["id"],
                    created_at=datetime.now(timezone.utc),
                )
            )
            await self.db.flush()

        return StripeInitOut(
            payment_intent_id=intent["id"],
            client_secret=intent["client_secret"],
            publishable_key=settings.STRIPE_PUBLISHABLE_KEY,
            amount_cents=inv.balance_cents,
        )

    async def list_for_invoice(self, invoice_id: UUID) -> list[PaymentOut]:
        """All payment rows for an invoice, newest first."""
        rows = (
            await self.db.execute(
                select(Payment)
                .where(Payment.invoice_id == invoice_id)
                .order_by(Payment.created_at.desc())
            )
        ).scalars().all()
        return [PaymentOut.model_validate(r) for r in rows]
