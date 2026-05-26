from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.soap_note import SoapNote
from app.schemas.soap_note import SoapNoteCreate, SoapNoteUpdate


class NotesService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, payload: SoapNoteCreate, author_id: UUID | None) -> SoapNote:
        note = SoapNote(**payload.model_dump(), author_id=author_id)
        self.db.add(note)
        await self.db.flush()
        await self.db.refresh(note)
        return note

    async def update(self, note_id: UUID, payload: SoapNoteUpdate) -> SoapNote:
        note = await self.db.get(SoapNote, note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(note, k, v)
        note.version += 1
        await self.db.flush()
        await self.db.refresh(note)
        return note

    async def list_for_patient(self, patient_id: UUID) -> list[SoapNote]:
        result = await self.db.execute(
            select(SoapNote)
            .where(SoapNote.patient_id == patient_id)
            .order_by(SoapNote.created_at.desc())
        )
        return list(result.scalars().all())

    async def delete(self, note_id: UUID) -> bool:
        """Hard delete a SOAP note. Returns True if a row was removed."""
        note = await self.db.get(SoapNote, note_id)
        if not note:
            return False
        await self.db.delete(note)
        await self.db.flush()
        return True
