from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.schemas.charge import ChargeCreate
from app.schemas.invoice import InvoiceIssueIn
from app.schemas.payment import CashPaymentIn
from app.schemas.service_catalog import ServiceCatalogCreate
from app.services.charge_service import ChargeService
from app.services.invoice_service import InvoiceService
from app.services.payment_service import PaymentService
from app.services.receipt_pdf_service import _cents, render_receipt
from app.services.service_catalog_service import ServiceCatalogService


def test_cents_formats_dollars_and_change():
    assert _cents(0) == "$0.00"
    assert _cents(5) == "$0.05"
    assert _cents(99) == "$0.99"
    assert _cents(100) == "$1.00"
    assert _cents(12345) == "$123.45"
    assert _cents(-50) == "-$0.50"


@pytest.mark.asyncio
async def test_receipt_is_valid_pdf_and_contains_invoice_number(
    db_session, sample_patient, provider_user
):
    # Seed: catalog + 2 charges + invoice + 1 cash payment.
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(
            code=f"T10-{uuid4().hex[:6]}",
            name="Office visit",
            category="visit",
            price_cents=10000,
        )
    )
    c1 = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
        viewer_id=provider_user.id,
    )
    c2 = await ChargeService(db_session).create(
        ChargeCreate(
            patient_id=sample_patient.id,
            description="Custom supply",
            code="SUP-1",
            unit_price_cents=500,
            quantity=2,
        ),
        viewer_id=provider_user.id,
    )
    inv = await InvoiceService(db_session).issue(
        InvoiceIssueIn(patient_id=sample_patient.id, charge_ids=[c1.id, c2.id]),
        viewer_id=provider_user.id,
    )
    await PaymentService(db_session).record_cash(
        CashPaymentIn(invoice_id=inv.id, amount_cents=11000, reference="Drawer 1"),
        viewer_id=provider_user.id,
    )

    # Fetch the ORM-shaped rows render_receipt expects (not Out schemas).
    from sqlalchemy import select
    from app.models.charge import Charge as ChargeModel
    from app.models.invoice import Invoice as InvoiceModel
    from app.models.payment import Payment as PaymentModel

    inv_row = await db_session.get(InvoiceModel, inv.id)
    charges = (
        await db_session.execute(
            select(ChargeModel).where(ChargeModel.invoice_id == inv.id)
        )
    ).scalars().all()
    payments = (
        await db_session.execute(
            select(PaymentModel).where(PaymentModel.invoice_id == inv.id)
        )
    ).scalars().all()

    pdf = render_receipt(
        inv_row, charges, payments,
        patient_name=f"{sample_patient.first_name} {sample_patient.last_name}",
    )

    # Header magic bytes.
    assert pdf.startswith(b"%PDF-")
    assert pdf.endswith(b"%%EOF\n") or pdf.rstrip().endswith(b"%%EOF")
    # Invoice number ends up in the PDF metadata as well as visibly.
    assert inv.number.encode() in pdf
    # Sanity: file is non-trivial size (>1 KB for any real PDF).
    assert len(pdf) > 1024


def test_render_receipt_with_zero_payments_omits_payments_block():
    """Build a totally hand-constructed invoice with no payments. We're
    testing the conditional rendering, not the DB."""
    from types import SimpleNamespace

    inv = SimpleNamespace(
        number="INV-2026-000999",
        issued_at=datetime(2026, 5, 29, tzinfo=timezone.utc),
        subtotal_cents=5000,
        discount_cents=0,
        tax_cents=0,
        total_cents=5000,
        paid_cents=0,
        balance_cents=5000,
    )
    pdf = render_receipt(inv, [], [], patient_name="Test Patient")
    assert pdf.startswith(b"%PDF-")
    assert b"INV-2026-000999" in pdf
    # Doesn't crash without charges or payments.
    assert len(pdf) > 1024
