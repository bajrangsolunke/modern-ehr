from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.schemas.charge import ChargeCreate
from app.schemas.invoice import InvoiceIssueIn
from app.schemas.service_catalog import ServiceCatalogCreate
from app.services.charge_service import ChargeService
from app.services.invoice_service import InvoiceService
from app.services.service_catalog_service import ServiceCatalogService


@pytest.mark.asyncio
async def test_issue_invoice_attaches_charges_and_computes_totals(
    db_session, sample_patient, provider_user
):
    a = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(code="T6-V1", name="V1", category="visit", price_cents=10000)
    )
    b = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(code="T6-V2", name="V2", category="visit", price_cents=3500)
    )
    c1 = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=a.id),
        viewer_id=provider_user.id,
    )
    c2 = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=b.id),
        viewer_id=provider_user.id,
    )

    inv = await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient.id, charge_ids=[c1.id, c2.id]),
        viewer_id=provider_user.id,
    )
    assert inv.status == "open"
    assert inv.subtotal_cents == 13500
    assert inv.total_cents == 13500
    assert inv.balance_cents == 13500
    assert inv.paid_cents == 0
    assert inv.number.startswith("INV-")
    # Number format: INV-YYYY-XXXXXX
    parts = inv.number.split("-")
    assert len(parts) == 3
    assert parts[0] == "INV"
    assert len(parts[1]) == 4 and parts[1].isdigit()
    assert len(parts[2]) == 6 and parts[2].isdigit()


@pytest.mark.asyncio
async def test_issue_with_invoice_level_discount(
    db_session, sample_patient, provider_user
):
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(code="T6-DISC", name="D", category="visit", price_cents=5000)
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
        viewer_id=provider_user.id,
    )
    inv = await InvoiceService(db_session).issue(
        InvoiceIssueIn(
            patient_id=sample_patient.id,
            charge_ids=[c.id],
            discount_cents=1000,
        ),
        viewer_id=provider_user.id,
    )
    assert inv.subtotal_cents == 5000
    assert inv.discount_cents == 1000
    assert inv.total_cents == 4000
    assert inv.balance_cents == 4000


@pytest.mark.asyncio
async def test_issue_rejects_charge_from_another_patient(
    db_session, sample_patient, provider_user
):
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(code="T6-MIX", name="M", category="visit", price_cents=100)
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
        viewer_id=provider_user.id,
    )
    with pytest.raises(HTTPException) as exc:
        await InvoiceService(db_session).issue(
            InvoiceIssueIn(patient_id=uuid4(), charge_ids=[c.id]),
            viewer_id=provider_user.id,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_issue_rejects_voided_charge(
    db_session, sample_patient, provider_user
):
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(code="T6-VOID", name="V", category="visit", price_cents=100)
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
        viewer_id=provider_user.id,
    )
    await ChargeService(db_session).void(
        c.id, viewer_id=provider_user.id, reason="test"
    )
    with pytest.raises(HTTPException) as exc:
        await InvoiceService(db_session).issue(
            InvoiceIssueIn(patient_id=sample_patient.id, charge_ids=[c.id]),
            viewer_id=provider_user.id,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_issue_rejects_already_invoiced_charge(
    db_session, sample_patient, provider_user
):
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(code="T6-DUP", name="D", category="visit", price_cents=100)
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
        viewer_id=provider_user.id,
    )
    await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient.id, charge_ids=[c.id]),
        viewer_id=provider_user.id,
    )
    # Second attempt to invoice the same charge → 409.
    with pytest.raises(HTTPException) as exc:
        await InvoiceService(db_session).issue(
            InvoiceIssueIn(patient_id=sample_patient.id, charge_ids=[c.id]),
            viewer_id=provider_user.id,
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_issue_rejects_unknown_charge_id(
    db_session, sample_patient, provider_user
):
    with pytest.raises(HTTPException) as exc:
        await InvoiceService(db_session).issue(
            InvoiceIssueIn(patient_id=sample_patient.id, charge_ids=[uuid4()]),
            viewer_id=provider_user.id,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_recalc_after_payment_updates_balance_and_status(
    db_session, sample_patient, provider_user
):
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(code="T6-PAY", name="P", category="visit", price_cents=10000)
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
        viewer_id=provider_user.id,
    )
    inv = await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient.id, charge_ids=[c.id]),
        viewer_id=provider_user.id,
    )

    # Simulate a partial payment of 6000 cents by writing the row directly.
    from app.models.payment import Payment
    db_session.add(
        Payment(
            invoice_id=inv.id,
            patient_id=sample_patient.id,
            method="cash",
            amount_cents=6000,
            status="succeeded",
        )
    )
    await db_session.flush()
    refreshed = await InvoiceService(db_session).recalc(inv.id)
    assert refreshed.paid_cents == 6000
    assert refreshed.balance_cents == 4000
    assert refreshed.status == "partially_paid"

    # Add a second payment that closes the balance.
    db_session.add(
        Payment(
            invoice_id=inv.id,
            patient_id=sample_patient.id,
            method="cash",
            amount_cents=4000,
            status="succeeded",
        )
    )
    await db_session.flush()
    refreshed = await InvoiceService(db_session).recalc(inv.id)
    assert refreshed.paid_cents == 10000
    assert refreshed.balance_cents == 0
    assert refreshed.status == "paid"


@pytest.mark.asyncio
async def test_recalc_ignores_non_succeeded_payments(
    db_session, sample_patient, provider_user
):
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(code="T6-PEND", name="P", category="visit", price_cents=5000)
    )
    c = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
        viewer_id=provider_user.id,
    )
    inv = await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient.id, charge_ids=[c.id]),
        viewer_id=provider_user.id,
    )

    from app.models.payment import Payment
    # Add a pending Stripe row and a failed cash row; neither should count.
    db_session.add(
        Payment(
            invoice_id=inv.id,
            patient_id=sample_patient.id,
            method="stripe",
            amount_cents=5000,
            status="pending",
            stripe_payment_intent_id="pi_test_pending_1",
        )
    )
    db_session.add(
        Payment(
            invoice_id=inv.id,
            patient_id=sample_patient.id,
            method="cash",
            amount_cents=1000,
            status="failed",
        )
    )
    await db_session.flush()
    refreshed = await InvoiceService(db_session).recalc(inv.id)
    assert refreshed.paid_cents == 0
    assert refreshed.balance_cents == 5000
    assert refreshed.status == "open"


@pytest.mark.asyncio
async def test_get_404_for_missing_invoice(db_session):
    with pytest.raises(HTTPException) as exc:
        await InvoiceService(db_session).get(uuid4())
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_list_for_patient_orders_newest_first(
    db_session, sample_patient, provider_user
):
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(code="T6-LIST", name="L", category="visit", price_cents=100)
    )
    c1 = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
        viewer_id=provider_user.id,
    )
    inv1 = await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient.id, charge_ids=[c1.id]),
        viewer_id=provider_user.id,
    )
    c2 = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
        viewer_id=provider_user.id,
    )
    inv2 = await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient.id, charge_ids=[c2.id]),
        viewer_id=provider_user.id,
    )
    items = await InvoiceService(db_session).list_for_patient(sample_patient.id)
    assert len(items) >= 2
    # Newest first — inv2 must come before inv1.
    inv1_idx = next(i for i, x in enumerate(items) if x.id == inv1.id)
    inv2_idx = next(i for i, x in enumerate(items) if x.id == inv2.id)
    assert inv2_idx < inv1_idx
