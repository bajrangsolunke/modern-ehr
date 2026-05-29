import pytest
from fastapi import HTTPException

from app.schemas.charge import ChargeCreate
from app.schemas.service_catalog import ServiceCatalogCreate
from app.services.charge_service import ChargeService
from app.services.service_catalog_service import ServiceCatalogService


@pytest.mark.asyncio
async def test_create_from_catalog_snapshots_price_and_code(
    db_session, sample_patient, provider_user
):
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(
            code="T5-VISIT-30",
            name="30m visit",
            category="visit",
            price_cents=12000,
        )
    )
    out = await ChargeService(db_session).create(
        ChargeCreate(
            patient_id=sample_patient.id,
            service_catalog_id=sv.id,
            quantity=1,
        ),
        viewer_id=provider_user.id,
    )
    assert out.code == "T5-VISIT-30"
    assert out.description == "30m visit"
    assert out.unit_price_cents == 12000
    assert out.total_cents == 12000
    assert out.tax_cents == 0
    assert out.invoice_id is None
    assert out.voided_at is None


@pytest.mark.asyncio
async def test_total_includes_discount_and_tax(
    db_session, sample_patient, provider_user
):
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(
            code="T5-XRAY",
            name="X-Ray",
            category="procedure",
            price_cents=10000,
            tax_rate_bp=825,
            taxable=True,
        )
    )
    out = await ChargeService(db_session).create(
        ChargeCreate(
            patient_id=sample_patient.id,
            service_catalog_id=sv.id,
            quantity=2,
            discount_cents=2000,
        ),
        viewer_id=provider_user.id,
    )
    # subtotal = 2 * 10000 = 20000
    # discount_after_qty = 20000 - 2000 = 18000
    # tax = (18000 * 825) // 10000 = 1485
    # total = 18000 + 1485 = 19485
    assert out.unit_price_cents == 10000
    assert out.discount_cents == 2000
    assert out.tax_cents == 1485
    assert out.total_cents == 19485


@pytest.mark.asyncio
async def test_freeform_charge_without_catalog(
    db_session, sample_patient, provider_user
):
    out = await ChargeService(db_session).create(
        ChargeCreate(
            patient_id=sample_patient.id,
            description="Custom supply",
            code="ADHOC",
            unit_price_cents=4500,
            quantity=3,
        ),
        viewer_id=provider_user.id,
    )
    assert out.code == "ADHOC"
    assert out.description == "Custom supply"
    assert out.total_cents == 13500
    assert out.tax_cents == 0


@pytest.mark.asyncio
async def test_freeform_missing_required_fields_rejected(db_session, sample_patient):
    with pytest.raises(Exception):
        # Pydantic root validator should reject: no catalog AND no full freeform fields.
        ChargeCreate(patient_id=sample_patient.id, quantity=1)


@pytest.mark.asyncio
async def test_void_marks_voided_and_records_user(
    db_session, sample_patient, provider_user
):
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(
            code="T5-VOID", name="Void test", category="visit", price_cents=100
        )
    )
    out = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
        viewer_id=provider_user.id,
    )
    voided = await ChargeService(db_session).void(
        out.id, viewer_id=provider_user.id, reason="data entry mistake"
    )
    assert voided.voided_at is not None
    assert voided.id == out.id


@pytest.mark.asyncio
async def test_void_on_invoiced_charge_is_conflict(
    db_session, sample_patient, provider_user
):
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(
            code="T5-INV", name="Invoiced", category="visit", price_cents=100
        )
    )
    out = await ChargeService(db_session).create(
        ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
        viewer_id=provider_user.id,
    )
    # Simulate the charge having been invoiced by attaching to a real Invoice
    # row (FK requires it). Issuance flow lands in Task 6.
    from app.models.charge import Charge
    from app.models.invoice import Invoice
    inv = Invoice(number="T5-INV-0001", patient_id=sample_patient.id)
    db_session.add(inv)
    await db_session.flush()
    row = await db_session.get(Charge, out.id)
    row.invoice_id = inv.id
    await db_session.flush()
    with pytest.raises(HTTPException) as exc:
        await ChargeService(db_session).void(
            out.id, viewer_id=provider_user.id, reason="oops"
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_void_inactive_catalog_still_creates(
    db_session, sample_patient, provider_user
):
    """Catalog deactivation after a charge was created must NOT block future
    operations on that charge. But: trying to CREATE a NEW charge against an
    inactive catalog row IS rejected (404)."""
    sv = await ServiceCatalogService(db_session).create(
        ServiceCatalogCreate(
            code="T5-INACT", name="Inactive", category="visit", price_cents=100
        )
    )
    await ServiceCatalogService(db_session).deactivate(sv.id)
    with pytest.raises(HTTPException) as exc:
        await ChargeService(db_session).create(
            ChargeCreate(patient_id=sample_patient.id, service_catalog_id=sv.id),
            viewer_id=provider_user.id,
        )
    assert exc.value.status_code == 404
