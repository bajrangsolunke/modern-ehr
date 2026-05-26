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

    # Fields the client may set on create. Anything outside this set
    # (e.g. risk_score, computed columns) is server-controlled.
    _CREATE_ALLOWED = frozenset(
        {
            "mrn",
            "first_name",
            "last_name",
            "sex",
            "dob",
            "email",
            "phone",
            "city",
            "avatar_url",
            "procedure",
            "procedure_date",
            "asa",
            "icu_needed",
            "tags",
            "assigned_physician_id",
            "risk",
            "status",
        }
    )

    async def create(self, payload: PatientCreate) -> Patient:
        existing = await self.repo.get_by_mrn(payload.mrn)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Patient with MRN {payload.mrn} already exists",
            )
        data = payload.model_dump(include=self._CREATE_ALLOWED)
        patient = Patient(**data)
        return await self.repo.add(patient)

    async def get(self, patient_id: UUID) -> Patient:
        patient = await self.repo.get(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        return patient

    # Fields the client may modify after create. mrn/sex/dob are intentionally
    # omitted (MRN is immutable, demographic changes need a separate flow).
    _UPDATE_ALLOWED = frozenset(
        {
            "first_name",
            "last_name",
            "email",
            "phone",
            "city",
            "procedure",
            "procedure_date",
            "asa",
            "icu_needed",
            "status",
            "risk",
            "tags",
            "assigned_physician_id",
        }
    )

    async def update(self, patient_id: UUID, payload: PatientUpdate) -> Patient:
        patient = await self.get(patient_id)
        data = payload.model_dump(exclude_unset=True, include=self._UPDATE_ALLOWED)
        for k, v in data.items():
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
            asa=filters.asa,
            icu_needed=filters.icu_needed,
            physician_id=filters.physician_id,
            sort_by=filters.sort_by,
            sort_dir=filters.sort_dir,
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
