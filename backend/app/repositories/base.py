from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, id_: UUID) -> ModelT | None:
        return await self.db.get(self.model, id_)

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        order_by=None,
        filters: list | None = None,
    ) -> tuple[list[ModelT], int]:
        stmt = select(self.model)
        if filters:
            for f in filters:
                stmt = stmt.where(f)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        total = await self.db.scalar(
            select(func.count()).select_from(stmt.subquery())
        ) or 0
        result = await self.db.execute(stmt.offset(offset).limit(limit))
        return list(result.scalars().all()), int(total)

    async def add(self, obj: ModelT) -> ModelT:
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def delete(self, obj: ModelT) -> None:
        await self.db.delete(obj)
        await self.db.flush()
