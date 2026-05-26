from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient, PatientStatus, RiskLevel
from app.repositories.base import BaseRepository


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
        physician_id: UUID | None = None,
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
        if physician_id:
            filters.append(Patient.assigned_physician_id == physician_id)

        return await self.list(
            offset=offset,
            limit=limit,
            order_by=Patient.created_at.desc(),
            filters=filters,
        )

    async def get_by_mrn(self, mrn: str) -> Patient | None:
        result = await self.db.execute(select(Patient).where(Patient.mrn == mrn))
        return result.scalar_one_or_none()
