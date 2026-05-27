from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import select

from app.ai.rag import RagService
from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.document import Document
from app.models.user import UserRole
from app.schemas.document import DocumentOut, DocumentUploadResponse
from app.services.audit_service import AuditService

# Documents are clinical artifacts — clinicians + admins write.
clinical_writer = Depends(require_roles(UserRole.provider, UserRole.admin))

# Reject anything beyond 25 MB so a stray upload can't fill memory.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("/patient/{patient_id}", response_model=list[DocumentOut])
async def list_for_patient(
    patient_id: UUID, db: DbSession, current: CurrentUser
) -> list[DocumentOut]:
    result = await db.execute(
        select(Document).where(Document.patient_id == patient_id).order_by(Document.created_at.desc())
    )
    return [DocumentOut.model_validate(d) for d in result.scalars().all()]


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[clinical_writer],
)
async def upload(
    request: Request,
    db: DbSession,
    current: CurrentUser,
    patient_id: UUID = Form(...),
    category: str = Form("general"),
    file: UploadFile = File(...),
) -> DocumentUploadResponse:
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
        )
    storage_key = f"docs/{patient_id}/{uuid4()}-{file.filename}"
    # NOTE: production should stream to object storage (S3 / GCS).
    extracted_text: str | None = None
    if (file.content_type or "").startswith("text/") and len(contents) < 1_000_000:
        try:
            extracted_text = contents.decode("utf-8", errors="ignore")
        except Exception:
            extracted_text = None

    doc = Document(
        patient_id=patient_id,
        name=file.filename or "uploaded",
        category=category,
        mime_type=file.content_type or "application/octet-stream",
        storage_key=storage_key,
        size_bytes=len(contents),
        extracted_text=extracted_text,
        uploaded_by=current.email,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)

    chunks_indexed = 0
    if extracted_text:
        chunks_indexed = await RagService(db).index_document(doc.id)

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="document.upload",
        resource_type="document",
        resource_id=str(doc.id),
        payload={
            "patient_id": str(patient_id),
            "name": doc.name,
            "category": category,
            "size_bytes": len(contents),
        },
    )

    return DocumentUploadResponse(
        document=DocumentOut.model_validate(doc),
        chunks_indexed=chunks_indexed,
    )
