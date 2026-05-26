from math import ceil
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.repositories.patient_repo import PatientRepository
from app.schemas.patient import (
    PatientCreate,
    PatientFilters,
    PatientListItem,
    PatientUpdate,
)
from app.schemas.common import Page


class PatientService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = PatientRepository(db)

    async def create(self, payload: PatientCreate) -> Patient:
        existing = await self.repo.get_by_mrn(payload.mrn)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Patient with MRN {payload.mrn} already exists",
            )
        patient = Patient(**payload.model_dump())
        return await self.repo.add(patient)

    async def get(self, patient_id: UUID) -> Patient:
        patient = await self.repo.get(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        return patient

    async def update(self, patient_id: UUID, payload: PatientUpdate) -> Patient:
        patient = await self.get(patient_id)
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(patient, k, v)
        await self.db.flush()
        await self.db.refresh(patient)
        return patient

    async def delete(self, patient_id: UUID) -> None:
        patient = await self.get(patient_id)
        await self.repo.delete(patient)

    async def list(
        self,
        filters: PatientFilters,
        page: int = 1,
        page_size: int = 20,
    ) -> Page[PatientListItem]:
        items, total = await self.repo.search(
            q=filters.q,
            status=filters.status,
            risk=filters.risk,
            physician_id=filters.physician_id,
            offset=(page - 1) * page_size,
            limit=page_size,
        )
        return Page[PatientListItem](
            items=[PatientListItem.model_validate(p) for p in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=ceil(total / page_size) if page_size else 1,
        )
