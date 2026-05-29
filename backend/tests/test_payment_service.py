from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models.invoice import Invoice
from app.schemas.charge import ChargeCreate
from app.schemas.invoice import InvoiceIssueIn
from app.schemas.payment import CashPaymentIn
from app.schemas.service_catalog import ServiceCatalogCreate
from app.services.charge_service import ChargeService
from app.services.invoice_service import InvoiceService
from app.services.payment_service import PaymentService
from app.services.service_catalog_service import ServiceCatalogService


async def _open_invoice(db_session, sample_patient, provider_user, price_cents=12000):
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(
            code=f"T8-{uuid4().hex[:6]}",
            name="visit",
            category="visit",
            price_cents=price_cents,
        )
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
        viewer_id=provider_user.id,
    )
    return await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient.id, charge_ids=[c.id]),
        viewer_id=provider_user.id,
    )


@pytest.mark.asyncio
async def test_cash_payment_marks_invoice_paid(
    db_session, sample_patient, provider_user
):
    inv = await _open_invoice(db_session, sample_patient, provider_user, 12000)
    out = await PaymentService(db_session).record_cash(
        CashPaymentIn(
            invoice_id=inv.id, amount_cents=12000, reference="Drawer A"
        ),
        viewer_id=provider_user.id,
    )
    assert out.status == "succeeded"
    assert out.method == "cash"
    assert out.amount_cents == 12000
    refreshed = await InvoiceService(db_session).get(inv.id)
    assert refreshed.status == "paid"
    assert refreshed.balance_cents == 0


@pytest.mark.asyncio
async def test_cash_partial_payment_moves_to_partially_paid(
    db_session, sample_patient, provider_user
):
    inv = await _open_invoice(db_session, sample_patient, provider_user, 10000)
    out = await PaymentService(db_session).record_cash(
        CashPaymentIn(invoice_id=inv.id, amount_cents=4000),
        viewer_id=provider_user.id,
    )
    assert out.status == "succeeded"
    refreshed = await InvoiceService(db_session).get(inv.id)
    assert refreshed.status == "partially_paid"
    assert refreshed.paid_cents == 4000
    assert refreshed.balance_cents == 6000


@pytest.mark.asyncio
async def test_cash_overpayment_rejected_with_400(
    db_session, sample_patient, provider_user
):
    inv = await _open_invoice(db_session, sample_patient, provider_user, 5000)
    with pytest.raises(HTTPException) as exc:
        await PaymentService(db_session).record_cash(
            CashPaymentIn(invoice_id=inv.id, amount_cents=6000),
            viewer_id=provider_user.id,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_cash_on_unknown_invoice_404(db_session, provider_user):
    with pytest.raises(HTTPException) as exc:
        await PaymentService(db_session).record_cash(
            CashPaymentIn(invoice_id=uuid4(), amount_cents=100),
            viewer_id=provider_user.id,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_cash_on_void_invoice_409(
    db_session, sample_patient, provider_user
):
    inv = await _open_invoice(db_session, sample_patient, provider_user, 1000)
    row = await db_session.get(Invoice, inv.id)
    row.status = "void"
    await db_session.flush()
    with pytest.raises(HTTPException) as exc:
        await PaymentService(db_session).record_cash(
            CashPaymentIn(invoice_id=inv.id, amount_cents=500),
            viewer_id=provider_user.id,
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_list_for_invoice_returns_succeeded_and_pending(
    db_session, sample_patient, provider_user
):
    inv = await _open_invoice(db_session, sample_patient, provider_user, 8000)
    a = await PaymentService(db_session).record_cash(
        CashPaymentIn(invoice_id=inv.id, amount_cents=3000),
        viewer_id=provider_user.id,
    )
    b = await PaymentService(db_session).record_cash(
        CashPaymentIn(invoice_id=inv.id, amount_cents=2000),
        viewer_id=provider_user.id,
    )
    items = await PaymentService(db_session).list_for_invoice(inv.id)
    # Newest first.
    assert len(items) >= 2
    assert items[0].id == b.id
    assert items[1].id == a.id


def test_cash_payment_amount_must_be_positive():
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        CashPaymentIn(invoice_id=uuid4(), amount_cents=0)
    with pytest.raises(ValidationError):
        CashPaymentIn(invoice_id=uuid4(), amount_cents=-1)


@pytest.mark.asyncio
async def test_init_stripe_creates_pending_row_and_returns_client_secret(
    db_session, sample_patient, provider_user, monkeypatch
):
    """Stripe is mocked at the wrapper module level — no network calls."""
    from app.integrations import stripe_client

    async def fake_ensure_customer(*, patient_id, name, email, existing_customer_id):
        return existing_customer_id or "cus_test_FAKE"

    async def fake_create_payment_intent(*, invoice_id, customer_id, amount_cents, description):
        return {
            "id": f"pi_test_{invoice_id}",
            "client_secret": f"pi_test_{invoice_id}_secret_xyz",
            "status": "requires_payment_method",
        }

    monkeypatch.setattr(stripe_client, "ensure_customer", fake_ensure_customer)
    monkeypatch.setattr(stripe_client, "create_payment_intent", fake_create_payment_intent)
    monkeypatch.setattr(
        "app.core.config.settings.STRIPE_PUBLISHABLE_KEY", "pk_test_FAKE", raising=False
    )

    inv = await _open_invoice(db_session, sample_patient, provider_user, 7000)
    from app.schemas.payment import StripeInitIn
    out = await PaymentService(db_session).init_stripe(
        StripeInitIn(invoice_id=inv.id)
    )
    assert out.payment_intent_id == f"pi_test_{inv.id}"
    assert out.client_secret.endswith("_secret_xyz")
    assert out.amount_cents == 7000

    # A pending payment row exists keyed by the PI id.
    from sqlalchemy import select
    from app.models.payment import Payment
    rows = (
        await db_session.execute(
            select(Payment).where(
                Payment.stripe_payment_intent_id == f"pi_test_{inv.id}"
            )
        )
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].status == "pending"
    assert rows[0].method == "stripe"

    # Re-initing the same invoice returns the SAME row, doesn't duplicate.
    out2 = await PaymentService(db_session).init_stripe(
        StripeInitIn(invoice_id=inv.id)
    )
    assert out2.payment_intent_id == out.payment_intent_id
    rows = (
        await db_session.execute(
            select(Payment).where(
                Payment.stripe_payment_intent_id == f"pi_test_{inv.id}"
            )
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_init_stripe_persists_customer_id_on_patient(
    db_session, sample_patient, provider_user, monkeypatch
):
    from app.integrations import stripe_client

    captured = {}

    async def fake_ensure_customer(*, patient_id, name, email, existing_customer_id):
        captured["call"] = (patient_id, name, email, existing_customer_id)
        return "cus_test_NEW"

    async def fake_create_payment_intent(**_):
        return {"id": "pi_test_a", "client_secret": "pi_test_a_secret", "status": "x"}

    monkeypatch.setattr(stripe_client, "ensure_customer", fake_ensure_customer)
    monkeypatch.setattr(stripe_client, "create_payment_intent", fake_create_payment_intent)
    monkeypatch.setattr(
        "app.core.config.settings.STRIPE_PUBLISHABLE_KEY", "pk_test_FAKE", raising=False
    )

    inv = await _open_invoice(db_session, sample_patient, provider_user, 2000)
    from app.schemas.payment import StripeInitIn
    await PaymentService(db_session).init_stripe(StripeInitIn(invoice_id=inv.id))

    # patient.stripe_customer_id is persisted so subsequent inits skip ensure_customer.
    from app.models.patient import Patient
    p = await db_session.get(Patient, sample_patient.id)
    assert p.stripe_customer_id == "cus_test_NEW"

    # Second init: existing_customer_id should be passed in.
    await PaymentService(db_session).init_stripe(StripeInitIn(invoice_id=inv.id))
    _, _, _, existing = captured["call"]
    # The second call's captured tuple overwrote the first — at the second call,
    # existing was the just-saved value.
    assert existing == "cus_test_NEW"
