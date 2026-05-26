from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.user import UserRole
from app.schemas.soap_note import SoapNoteCreate, SoapNoteOut, SoapNoteUpdate
from app.services.audit_service import AuditService
from app.services.notes_service import NotesService

# Writing clinical notes is a clinician-only action.
clinician_only = Depends(
    require_roles(UserRole.physician, UserRole.surgeon, UserRole.admin)
)

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/patient/{patient_id}", response_model=list[SoapNoteOut])
async def list_for_patient(
    patient_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth check
) -> list[SoapNoteOut]:
    notes = await NotesService(db).list_for_patient(patient_id)
    return [SoapNoteOut.model_validate(n) for n in notes]


@router.post(
    "",
    response_model=SoapNoteOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[clinician_only],
)
async def create_note(
    payload: SoapNoteCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> SoapNoteOut:
    note = await NotesService(db).create(payload, author_id=current.id)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="soap.create",
        resource_type="soap_note",
        resource_id=str(note.id),
        payload={"patient_id": str(note.patient_id)},
    )
    return SoapNoteOut.model_validate(note)


@router.patch(
    "/{note_id}",
    response_model=SoapNoteOut,
    dependencies=[clinician_only],
)
async def update_note(
    note_id: UUID,
    payload: SoapNoteUpdate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> SoapNoteOut:
    note = await NotesService(db).update(note_id, payload)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="soap.update",
        resource_type="soap_note",
        resource_id=str(note.id),
        payload=payload.model_dump(exclude_unset=True),
    )
    return SoapNoteOut.model_validate(note)


@router.delete(
    "/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[clinician_only],
)
async def delete_note(
    note_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    deleted = await NotesService(db).delete(note_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="SOAP note not found")
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="soap.delete",
        resource_type="soap_note",
        resource_id=str(note_id),
    )
