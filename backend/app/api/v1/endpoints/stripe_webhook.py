"""Stripe webhook endpoint.

The browser's success callback only nudges the UI — this endpoint is
the **authoritative confirmation** that a PaymentIntent succeeded or
failed. Signature is verified against STRIPE_WEBHOOK_SECRET; replays
and unknown PIs are no-ops.

Over-pay guard: when a `payment_intent.succeeded` event arrives but
the invoice has already been paid (e.g. front desk took cash while
the patient was on the Stripe checkout), the pending row is moved to
`cancelled` instead of `succeeded`. The patient is not double-charged;
auto-refund is a P3 follow-up."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession
from app.core.logging import get_logger
from app.integrations import stripe_client
from app.models.invoice import Invoice
from app.models.payment import Payment, PaymentStatus
from app.services.audit_service import AuditService
from app.services.invoice_service import InvoiceService


log = get_logger(__name__)

router = APIRouter(prefix="/billing/stripe", tags=["billing-stripe"])


@router.post("/webhook", status_code=status.HTTP_204_NO_CONTENT)
async def stripe_webhook(
    request: Request,
    db: DbSession,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> None:
    if stripe_signature is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe signature",
        )
    raw = await request.body()
    try:
        event = stripe_client.verify_webhook(raw, stripe_signature)
    except Exception as exc:  # noqa: BLE001 — signature failure surfaces as a single 400
        log.warning("stripe_webhook_verify_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature"
        ) from exc

    await _handle_event(db, event)


def _event_field(event, key: str):
    """Stripe's library returns either dict-shaped events (from JSON) or
    its own `StripeObject` (after `construct_event`). Support both."""
    if isinstance(event, dict):
        return event.get(key)
    return getattr(event, key, None)


def _data_object(event):
    data = _event_field(event, "data")
    if isinstance(data, dict):
        return data.get("object")
    return getattr(data, "object", None) if data is not None else None


def _obj_field(obj, key: str):
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


async def _handle_event(db: AsyncSession, event) -> None:
    """Dispatch a verified Stripe event. Idempotent on event id AND on
    payment state (already-succeeded rows return immediately)."""
    event_type = _event_field(event, "type")
    event_id = _event_field(event, "id")
    data = _data_object(event)

    if event_type == "payment_intent.succeeded":
        await _handle_succeeded(db, event_id, data)
        return

    if event_type == "payment_intent.payment_failed":
        await _handle_failed(db, event_id, data)
        return

    log.info("stripe_webhook_unhandled", event_type=event_type, event_id=event_id)


async def _find_payment(db: AsyncSession, pi_id: str) -> Payment | None:
    """Look up the Payment row keyed by stripe_payment_intent_id, with
    FOR UPDATE so concurrent webhook deliveries serialise."""
    return (
        await db.execute(
            select(Payment)
            .where(Payment.stripe_payment_intent_id == pi_id)
            .with_for_update()
        )
    ).scalar_one_or_none()


async def _handle_succeeded(db: AsyncSession, event_id, data) -> None:
    pi_id = _obj_field(data, "id")
    if not pi_id:
        log.warning("stripe_webhook_missing_pi_id", event_id=event_id)
        return

    row = await _find_payment(db, pi_id)
    if row is None:
        log.warning("stripe_webhook_unknown_pi", pi_id=pi_id, event_id=event_id)
        return
    if row.status == PaymentStatus.succeeded.value:
        return  # idempotent — already applied
    if row.status != PaymentStatus.pending.value:
        # Don't reflip cancelled/failed rows. Either the over-pay guard
        # already cancelled this, or a manual flow moved it elsewhere.
        log.info(
            "stripe_webhook_skip_non_pending",
            pi_id=pi_id,
            status=row.status,
            event_id=event_id,
        )
        return

    # Over-pay guard — applying this payment must not push paid_cents
    # above total_cents. Re-lock the invoice for the check.
    inv = (
        await db.execute(
            select(Invoice).where(Invoice.id == row.invoice_id).with_for_update()
        )
    ).scalar_one()
    projected_paid = inv.paid_cents + row.amount_cents
    if projected_paid > inv.total_cents:
        # Cash or a sibling Stripe payment already covered it. Mark
        # this row cancelled so a replay doesn't try again.
        row.status = PaymentStatus.cancelled.value
        await db.flush()
        await AuditService(db).record(
            user_id=None,
            action="payment.stripe_overpay_guarded",
            resource_type="payment",
            resource_id=str(row.id),
            payload={
                "invoice_id": str(inv.id),
                "would_have_been_cents": row.amount_cents,
                "invoice_total_cents": inv.total_cents,
                "invoice_paid_cents": inv.paid_cents,
                "event_id": str(event_id) if event_id else None,
            },
        )
        log.warning(
            "stripe_webhook_overpay_cancelled",
            pi_id=pi_id,
            invoice_id=str(inv.id),
            projected_paid=projected_paid,
            total=inv.total_cents,
        )
        return

    # Happy path — flip + capture card details + recalc.
    row.status = PaymentStatus.succeeded.value
    charges_data = (
        _obj_field(data, "charges").get("data", [])
        if isinstance(_obj_field(data, "charges"), dict)
        else []
    )
    if charges_data:
        card = (
            charges_data[0].get("payment_method_details", {}).get("card", {})
            or {}
        )
        row.last4 = card.get("last4")
        row.card_brand = card.get("brand")
    latest_charge = _obj_field(data, "latest_charge")
    if latest_charge:
        row.stripe_charge_id = latest_charge
    await db.flush()
    await InvoiceService(db).recalc(row.invoice_id)
    await AuditService(db).record(
        user_id=None,
        action="payment.stripe",
        resource_type="payment",
        resource_id=str(row.id),
        payload={
            "invoice_id": str(row.invoice_id),
            "amount_cents": row.amount_cents,
            "event_id": str(event_id) if event_id else None,
        },
    )


async def _handle_failed(db: AsyncSession, event_id, data) -> None:
    pi_id = _obj_field(data, "id")
    if not pi_id:
        return
    row = await _find_payment(db, pi_id)
    if row is None:
        return
    if row.status not in (
        PaymentStatus.pending.value,
        PaymentStatus.failed.value,
    ):
        # Already terminal — don't move backwards.
        return
    if row.status == PaymentStatus.failed.value:
        return  # idempotent
    row.status = PaymentStatus.failed.value
    await db.flush()
    log.info(
        "stripe_webhook_payment_failed",
        pi_id=pi_id,
        event_id=event_id,
    )
