"""Patient-facing documents listing + safe download. Returns only the
documents owned by the authenticated patient — no cross-patient access."""
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.schemas.patient_portal_documents import (
    PatientDocumentListOut,
    PatientDocumentOut,
)


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
