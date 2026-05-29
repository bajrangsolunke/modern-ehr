from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service_catalog import ServiceCatalog
from app.schemas.service_catalog import (
    ServiceCatalogCreate,
    ServiceCatalogOut,
    ServiceCatalogUpdate,
)


class ServiceCatalogService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, payload: ServiceCatalogCreate) -> ServiceCatalogOut:
        existing = (
            await self.db.execute(
                select(ServiceCatalog).where(ServiceCatalog.code == payload.code)
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Service code '{payload.code}' already exists",
            )
        row = ServiceCatalog(**payload.model_dump())
        self.db.add(row)
        await self.db.commit()
        await self.db.refresh(row)
        return ServiceCatalogOut.model_validate(row)

    async def get(self, service_id: UUID) -> ServiceCatalogOut:
        row = await self.db.get(ServiceCatalog, service_id)
        if row is None:
            raise HTTPException(404, "Service not found")
        return ServiceCatalogOut.model_validate(row)

    async def update(
        self, service_id: UUID, payload: ServiceCatalogUpdate
    ) -> ServiceCatalogOut:
        row = await self.db.get(ServiceCatalog, service_id)
        if row is None:
            raise HTTPException(404, "Service not found")
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        await self.db.commit()
        await self.db.refresh(row)
        return ServiceCatalogOut.model_validate(row)

    async def deactivate(self, service_id: UUID) -> None:
        row = await self.db.get(ServiceCatalog, service_id)
        if row is None:
            raise HTTPException(404, "Service not found")
        row.is_active = False
        await self.db.commit()

    async def list(
        self,
        q: str | None = None,
        active_only: bool = True,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[ServiceCatalogOut], int]:
        stmt = select(ServiceCatalog)
        count_stmt = select(func.count(ServiceCatalog.id))
        if active_only:
            stmt = stmt.where(ServiceCatalog.is_active.is_(True))
            count_stmt = count_stmt.where(ServiceCatalog.is_active.is_(True))
        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(
                ServiceCatalog.name.ilike(like) | ServiceCatalog.code.ilike(like)
            )
            count_stmt = count_stmt.where(
                ServiceCatalog.name.ilike(like) | ServiceCatalog.code.ilike(like)
            )
        total = (await self.db.execute(count_stmt)).scalar_one()
        stmt = (
            stmt.order_by(ServiceCatalog.name.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return [ServiceCatalogOut.model_validate(r) for r in rows], total
