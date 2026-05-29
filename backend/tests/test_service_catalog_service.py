import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.service_catalog import ServiceCatalogCreate
from app.services.service_catalog_service import ServiceCatalogService


@pytest.mark.asyncio
async def test_create_service_assigns_id(db_session):
    svc = ServiceCatalogService(db_session)
    out = await svc.create(
        ServiceCatalogCreate(
            code="VISIT-30",
            name="30-minute follow-up",
            category="visit",
            price_cents=12500,
        )
    )
    assert out.id is not None
    assert out.price_cents == 12500
    assert out.is_active is True


@pytest.mark.asyncio
async def test_soft_delete_marks_inactive(db_session):
    svc = ServiceCatalogService(db_session)
    out = await svc.create(
        ServiceCatalogCreate(code="LAB-CBC", name="CBC", category="lab", price_cents=4000)
    )
    await svc.deactivate(out.id)
    fetched = await svc.get(out.id)
    assert fetched.is_active is False


@pytest.mark.asyncio
async def test_list_filters_to_active_by_default(db_session):
    svc = ServiceCatalogService(db_session)
    a = await svc.create(
        ServiceCatalogCreate(code="LST-A", name="A", category="visit", price_cents=100)
    )
    b = await svc.create(
        ServiceCatalogCreate(code="LST-B", name="B", category="visit", price_cents=200)
    )
    await svc.deactivate(b.id)
    items, total = await svc.list(active_only=True)
    ids = {i.id for i in items}
    assert a.id in ids
    assert b.id not in ids
    # `total` is the count of active rows seen — at minimum our `a`.
    assert total == 1


@pytest.mark.asyncio
async def test_create_rejects_negative_price(db_session):
    with pytest.raises(ValidationError):
        ServiceCatalogCreate(code="X", name="X", category="visit", price_cents=-1)


@pytest.mark.asyncio
async def test_create_duplicate_code_is_conflict(db_session):
    svc = ServiceCatalogService(db_session)
    await svc.create(
        ServiceCatalogCreate(code="DUP-1", name="A", category="visit", price_cents=100)
    )
    with pytest.raises(HTTPException):
        await svc.create(
            ServiceCatalogCreate(code="DUP-1", name="B", category="visit", price_cents=200)
        )
