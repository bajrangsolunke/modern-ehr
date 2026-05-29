from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.charge import Charge
from app.models.invoice import Invoice
from app.models.payment import Payment, PaymentStatus
from app.schemas.invoice import InvoiceIssueIn, InvoiceOut
from app.services.audit_service import AuditService


def _make_number(year: int, seq: int) -> str:
    """`INV-YYYY-XXXXXX` (zero-padded to 6 digits)."""
    return f"INV-{year}-{seq:06d}"


class InvoiceService:
    """Issue, read, and recompute invoice totals.

    `issue()` is the only public entry that takes uninvoiced charges and
    binds them; `recalc()` is the only path that updates paid/balance/
    status from `payments`. Anything else (void, refund) lands in P3."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _next_number(self) -> str:
        seq = (
            await self.db.execute(select(func.nextval("invoice_number_seq")))
        ).scalar_one()
        return _make_number(datetime.now(timezone.utc).year, int(seq))

    async def issue(
        self, payload: InvoiceIssueIn, *, viewer_id: UUID
    ) -> InvoiceOut:
        """Atomically bind a set of uninvoiced charges to a new invoice."""
        rows = (
            await self.db.execute(
                select(Charge).where(Charge.id.in_(payload.charge_ids))
            )
        ).scalars().all()
        if len(rows) != len(payload.charge_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more charges not found",
            )
        for c in rows:
            if c.patient_id != payload.patient_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Charge belongs to a different patient",
                )
            if c.invoice_id is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Charge {c.id} already on an invoice",
                )
            if c.voided_at is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Charge {c.id} is voided",
                )

        subtotal = sum(c.total_cents for c in rows)
        total = max(0, subtotal - payload.discount_cents)
        now = datetime.now(timezone.utc)

        inv = Invoice(
            number=await self._next_number(),
            patient_id=payload.patient_id,
            status="open",
            subtotal_cents=subtotal,
            discount_cents=payload.discount_cents,
            tax_cents=0,
            total_cents=total,
            paid_cents=0,
            balance_cents=total,
            issued_at=now,
            due_at=now + timedelta(days=14),
            notes=payload.notes,
            created_at=now,
        )
        self.db.add(inv)
        await self.db.flush()
        for c in rows:
            c.invoice_id = inv.id
        await self.db.flush()
        await self.db.refresh(inv)
        await AuditService(self.db).record(
            user_id=viewer_id,
            action="invoice.issue",
            resource_type="invoice",
            resource_id=str(inv.id),
            payload={
                "number": inv.number,
                "charge_count": len(rows),
                "total_cents": inv.total_cents,
            },
        )
        return InvoiceOut.model_validate(inv)

    async def get(self, invoice_id: UUID) -> InvoiceOut:
        """Read by id. 404 if missing."""
        row = await self.db.get(Invoice, invoice_id)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
            )
        return InvoiceOut.model_validate(row)

    async def list_for_patient(self, patient_id: UUID) -> list[InvoiceOut]:
        """All invoices for a patient, newest first."""
        rows = (
            await self.db.execute(
                select(Invoice)
                .where(Invoice.patient_id == patient_id)
                .order_by(Invoice.created_at.desc())
            )
        ).scalars().all()
        return [InvoiceOut.model_validate(r) for r in rows]

    async def recalc(self, invoice_id: UUID) -> InvoiceOut:
        """Recompute paid_cents + balance_cents + status from succeeded
        payments. Call inside the same transaction as the payment write
        so callers see a consistent snapshot."""
        inv = await self.db.get(Invoice, invoice_id)
        if inv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
            )
        paid = (
            await self.db.execute(
                select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(
                    Payment.invoice_id == invoice_id,
                    Payment.status == PaymentStatus.succeeded.value,
                )
            )
        ).scalar_one()
        inv.paid_cents = int(paid)
        inv.balance_cents = max(0, inv.total_cents - inv.paid_cents)
        # Don't overwrite terminal statuses set by void/refund flows.
        if inv.status not in {"void", "refunded", "draft"}:
            if inv.balance_cents == 0 and inv.total_cents > 0:
                inv.status = "paid"
            elif inv.paid_cents > 0:
                inv.status = "partially_paid"
            else:
                inv.status = "open"
        await self.db.flush()
        await self.db.refresh(inv)
        return InvoiceOut.model_validate(inv)
