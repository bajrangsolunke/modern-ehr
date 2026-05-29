from uuid import uuid4

import pytest

from app.api.v1.endpoints.stripe_webhook import _handle_event
from app.models.payment import Payment
from app.schemas.charge import ChargeCreate
from app.schemas.invoice import InvoiceIssueIn
from app.schemas.service_catalog import ServiceCatalogCreate
from app.services.charge_service import ChargeService
from app.services.invoice_service import InvoiceService
from app.services.service_catalog_service import ServiceCatalogService


async def _seed_pending(db_session, sample_patient, provider_user, amount=5000, pi_id=None):
    """Seed: open invoice + pending Stripe row that the webhook will resolve."""
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(
            code=f"T9-{uuid4().hex[:6]}",
            name="visit",
            category="visit",
            price_cents=amount,
        )
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
        viewer_id=provider_user.id,
    )
    inv = await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient.id, charge_ids=[c.id]),
        viewer_id=provider_user.id,
    )
    pi_id = pi_id or f"pi_test_{uuid4().hex[:10]}"
    pending = Payment(
        invoice_id=inv.id,
        patient_id=sample_patient.id,
        method="stripe",
        amount_cents=amount,
        status="pending",
        stripe_payment_intent_id=pi_id,
    )
    db_session.add(pending)
    await db_session.flush()
    return inv, pending, pi_id


def _succeeded_event(pi_id: str, amount: int, brand="visa", last4="4242"):
    return {
        "id": f"evt_{uuid4().hex[:12]}",
        "type": "payment_intent.succeeded",
        "data": {
            "object": {
                "id": pi_id,
                "amount": amount,
                "latest_charge": f"ch_{uuid4().hex[:10]}",
                "charges": {
                    "data": [
                        {
                            "payment_method_details": {
                                "card": {"brand": brand, "last4": last4}
                            }
                        }
                    ]
                },
            }
        },
    }


def _failed_event(pi_id: str):
    return {
        "id": f"evt_{uuid4().hex[:12]}",
        "type": "payment_intent.payment_failed",
        "data": {"object": {"id": pi_id, "amount": 0}},
    }


@pytest.mark.asyncio
async def test_succeeded_flips_payment_and_invoice(
    db_session, sample_patient, provider_user
):
    inv, pending, pi_id = await _seed_pending(
        db_session, sample_patient, provider_user, 5000
    )
    await _handle_event(db_session, _succeeded_event(pi_id, 5000))
    await db_session.refresh(pending)
    assert pending.status == "succeeded"
    assert pending.last4 == "4242"
    assert pending.card_brand == "visa"

    refreshed = await InvoiceService(db_session).get(inv.id)
    assert refreshed.status == "paid"
    assert refreshed.balance_cents == 0


@pytest.mark.asyncio
async def test_replay_is_idempotent(
    db_session, sample_patient, provider_user
):
    inv, pending, pi_id = await _seed_pending(
        db_session, sample_patient, provider_user, 4000
    )
    evt = _succeeded_event(pi_id, 4000)
    await _handle_event(db_session, evt)
    await _handle_event(db_session, evt)  # replay
    await _handle_event(db_session, evt)  # replay again

    from sqlalchemy import select, func
    count = (
        await db_session.execute(
            select(func.count(Payment.id)).where(
                Payment.stripe_payment_intent_id == pi_id
            )
        )
    ).scalar_one()
    assert count == 1  # no duplicates

    inv_after = await InvoiceService(db_session).get(inv.id)
    assert inv_after.paid_cents == 4000  # not 8000 or 12000


@pytest.mark.asyncio
async def test_unknown_payment_intent_is_a_noop(db_session):
    """Webhook for a PI we don't have a row for — log + 2xx, no rows mutated."""
    # Should not raise.
    await _handle_event(
        db_session, _succeeded_event("pi_test_unknown_xyz", 1000)
    )


@pytest.mark.asyncio
async def test_payment_failed_flips_to_failed(
    db_session, sample_patient, provider_user
):
    _, pending, pi_id = await _seed_pending(
        db_session, sample_patient, provider_user, 2000
    )
    await _handle_event(db_session, _failed_event(pi_id))
    await db_session.refresh(pending)
    assert pending.status == "failed"


@pytest.mark.asyncio
async def test_cancelled_row_not_reflipped(
    db_session, sample_patient, provider_user
):
    """If a payment row is already 'cancelled' (e.g. over-pay guard fired),
    a late-arriving succeeded webhook must NOT flip it back."""
    _, pending, pi_id = await _seed_pending(
        db_session, sample_patient, provider_user, 1000
    )
    pending.status = "cancelled"
    await db_session.flush()
    await _handle_event(db_session, _succeeded_event(pi_id, 1000))
    await db_session.refresh(pending)
    assert pending.status == "cancelled"


@pytest.mark.asyncio
async def test_overpay_guard_cancels_row(
    db_session, sample_patient, provider_user
):
    """Cash payment closed the balance while Stripe checkout was open.
    Webhook arrives; flipping pending → succeeded would push paid_cents
    over total_cents. Handler must cancel the row, NOT mark succeeded."""
    from app.schemas.payment import CashPaymentIn
    from app.services.payment_service import PaymentService

    # Seed invoice + a pending Stripe row for the full balance.
    inv, pending, pi_id = await _seed_pending(
        db_session, sample_patient, provider_user, 5000
    )

    # Bypass the T8 defensive guard by marking the pending row as
    # `cancelled` before taking cash — but actually we want to
    # simulate the race where cash slipped past it. So: clear the
    # pending row's row.status field for the duration of cash, then
    # re-pend it.
    pending.status = "cancelled"
    await db_session.flush()
    await PaymentService(db_session).record_cash(
        CashPaymentIn(invoice_id=inv.id, amount_cents=5000),
        viewer_id=provider_user.id,
    )
    # Now restore the row to pending and fire the webhook.
    pending.status = "pending"
    await db_session.flush()

    inv_before = await InvoiceService(db_session).get(inv.id)
    assert inv_before.paid_cents == 5000  # cash already covered it
    assert inv_before.balance_cents == 0

    await _handle_event(db_session, _succeeded_event(pi_id, 5000))
    await db_session.refresh(pending)
    assert pending.status == "cancelled"  # over-pay guard fired

    inv_after = await InvoiceService(db_session).get(inv.id)
    assert inv_after.paid_cents == 5000  # not 10000
    assert inv_after.status == "paid"


@pytest.mark.asyncio
async def test_unhandled_event_type_is_a_noop(db_session):
    """Webhook with an event type we don't handle (e.g. customer.updated)
    — should not raise."""
    evt = {
        "id": f"evt_{uuid4().hex[:12]}",
        "type": "customer.updated",
        "data": {"object": {"id": "cus_test_xyz"}},
    }
    await _handle_event(db_session, evt)  # no raise = pass
