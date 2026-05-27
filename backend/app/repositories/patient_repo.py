from typing import Literal
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.patient import Patient, PatientStatus, RiskLevel
from app.repositories.base import BaseRepository

# Whitelist of sortable columns. Anything outside this set falls back to
# created_at so a client can't ORDER BY arbitrary attributes.
_SORTABLE = {
    "mrn": Patient.mrn,
    "first_name": Patient.first_name,
    "procedure_date": Patient.procedure_date,
    "risk_score": Patient.risk_score,
    "created_at": Patient.created_at,
}


class PatientRepository(BaseRepository[Patient]):
    model = Patient

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db)

    async def search(
        self,
        *,
        q: str | None = None,
        status: PatientStatus | None = None,
        risk: RiskLevel | None = None,
        asa: str | None = None,
        icu_needed: bool | None = None,
        physician_id: UUID | None = None,
        sort_by: str = "created_at",
        sort_dir: Literal["asc", "desc"] = "desc",
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Patient], int]:
        filters: list = []
        if q:
            like = f"%{q.lower()}%"
            filters.append(
                or_(
                    Patient.mrn.ilike(like),
                    Patient.first_name.ilike(like),
                    Patient.last_name.ilike(like),
                    Patient.procedure.ilike(like),
                )
            )
        if status:
            filters.append(Patient.status == status)
        if risk:
            filters.append(Patient.risk == risk)
        if asa:
            filters.append(Patient.asa == asa)
        if icu_needed is not None:
            filters.append(Patient.icu_needed == icu_needed)
        if physician_id:
            filters.append(Patient.assigned_physician_id == physician_id)

        col = _SORTABLE.get(sort_by, Patient.created_at)
        order_by = col.asc() if sort_dir == "asc" else col.desc()

        # Custom query so we can eager-load the assigned provider —
        # PatientListItem renders the provider's display name.
        stmt = select(Patient).options(selectinload(Patient.assigned_physician))
        for f in filters:
            stmt = stmt.where(f)
        stmt = stmt.order_by(order_by)

        total = await self.db.scalar(
            select(func.count()).select_from(stmt.subquery())
        ) or 0
        result = await self.db.execute(stmt.offset(offset).limit(limit))
        return list(result.scalars().unique().all()), int(total)

    async def get_by_mrn(self, mrn: str) -> Patient | None:
        result = await self.db.execute(select(Patient).where(Patient.mrn == mrn))
        return result.scalar_one_or_none()

    async def get(self, id_: UUID) -> Patient | None:
        result = await self.db.execute(
            select(Patient)
            .options(selectinload(Patient.assigned_physician))
            .where(Patient.id == id_)
        )
        return result.scalar_one_or_none()
