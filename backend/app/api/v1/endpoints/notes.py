from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.soap_note import SoapNoteCreate, SoapNoteOut, SoapNoteUpdate
from app.services.notes_service import NotesService

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/patient/{patient_id}", response_model=list[SoapNoteOut])
async def list_for_patient(
    patient_id: UUID, db: DbSession, current: CurrentUser
) -> list[SoapNoteOut]:
    notes = await NotesService(db).list_for_patient(patient_id)
    return [SoapNoteOut.model_validate(n) for n in notes]


@router.post("", response_model=SoapNoteOut, status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: SoapNoteCreate, db: DbSession, current: CurrentUser
) -> SoapNoteOut:
    note = await NotesService(db).create(payload, author_id=current.id)
    return SoapNoteOut.model_validate(note)


@router.patch("/{note_id}", response_model=SoapNoteOut)
async def update_note(
    note_id: UUID,
    payload: SoapNoteUpdate,
    db: DbSession,
    current: CurrentUser,
) -> SoapNoteOut:
    note = await NotesService(db).update(note_id, payload)
    return SoapNoteOut.model_validate(note)
