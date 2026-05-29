from math import ceil
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.user import UserRole
from app.schemas.common import Page
from app.schemas.service_catalog import (
    ServiceCatalogCreate,
    ServiceCatalogOut,
    ServiceCatalogUpdate,
)
from app.services.service_catalog_service import ServiceCatalogService


router = APIRouter(prefix="/billing/services", tags=["billing-services"])

admin_only = Depends(require_roles(UserRole.admin))


@router.get("", response_model=Page[ServiceCatalogOut])
async def list_services(
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
    q: str | None = None,
    active_only: bool = True,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> Page[ServiceCatalogOut]:
    items, total = await ServiceCatalogService(db).list(
        q=q, active_only=active_only, page=page, page_size=page_size
    )
    return Page[ServiceCatalogOut](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 1,
    )


@router.post("", response_model=ServiceCatalogOut, status_code=status.HTTP_201_CREATED, dependencies=[admin_only])
async def create_service(
    payload: ServiceCatalogCreate, db: DbSession, current: CurrentUser  # noqa: ARG001
) -> ServiceCatalogOut:
    return await ServiceCatalogService(db).create(payload)


@router.patch("/{service_id}", response_model=ServiceCatalogOut, dependencies=[admin_only])
async def update_service(
    service_id: UUID,
    payload: ServiceCatalogUpdate,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> ServiceCatalogOut:
    return await ServiceCatalogService(db).update(service_id, payload)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[admin_only])
async def deactivate_service(
    service_id: UUID, db: DbSession, current: CurrentUser  # noqa: ARG001
) -> None:
    await ServiceCatalogService(db).deactivate(service_id)
