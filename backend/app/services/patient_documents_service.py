"""Patient-facing documents listing, upload, and safe download. Patient
uploads tag `uploaded_by` with a `patient:` prefix so the provider
portal can filter for client-uploaded docs."""
from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.patient import Patient
from app.schemas.patient_portal_documents import (
    PatientDocumentListOut,
    PatientDocumentOut,
)


MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20MB
ALLOWED_CATEGORIES = {
    "consent",
    "imaging",
    "lab",
    "insurance",
    "referral",
    "discharge",
    "general",
}


class PatientDocumentsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_patient(self, patient_id: UUID) -> PatientDocumentListOut:
        rows = (
            await self.db.execute(
                select(Document)
                .where(Document.patient_id == patient_id)
                .order_by(Document.created_at.desc())
            )
        ).scalars().all()
        items = [
            PatientDocumentOut(
                id=r.id,
                name=r.name,
                category=r.category,
                mime_type=r.mime_type,
                size_bytes=r.size_bytes,
                uploaded_by=r.uploaded_by,
                created_at=r.created_at,
            )
            for r in rows
        ]
        return PatientDocumentListOut(items=items, total=len(items))

    async def get_for_patient(self, patient_id: UUID, doc_id: UUID) -> Document:
        doc = await self.db.get(Document, doc_id)
        if doc is None or doc.patient_id != patient_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
            )
        return doc

    async def upload_for_patient(
        self,
        patient_id: UUID,
        file: UploadFile,
        category: str,
    ) -> PatientDocumentOut:
        if category not in ALLOWED_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported category. Allowed: {sorted(ALLOWED_CATEGORIES)}",
            )
        contents = await file.read()
        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
            )
        patient = await self.db.get(Patient, patient_id)
        display_name = (
            f"{patient.first_name} {patient.last_name}".strip()
            if patient
            else "Patient"
        )
        doc = Document(
            patient_id=patient_id,
            name=file.filename or "uploaded",
            category=category,
            mime_type=file.content_type or "application/octet-stream",
            storage_key=f"docs/{patient_id}/{uuid4()}-{file.filename}",
            size_bytes=len(contents),
            uploaded_by=f"patient:{display_name}",
            content=contents,
        )
        self.db.add(doc)
        await self.db.commit()
        await self.db.refresh(doc)
        return PatientDocumentOut(
            id=doc.id,
            name=doc.name,
            category=doc.category,
            mime_type=doc.mime_type,
            size_bytes=doc.size_bytes,
            uploaded_by=doc.uploaded_by,
            created_at=doc.created_at,
        )
