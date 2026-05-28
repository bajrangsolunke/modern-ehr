"""
Document library endpoints.
User stories US-DOCS-1..US-DOCS-6 in
docs/superpowers/specs/2026-05-27-workflow-user-stories.md.
"""
from datetime import datetime
from math import ceil
from urllib.parse import quote
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.ai.rag import RagService
from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.document import Document
from app.models.patient import Patient
from app.models.user import UserRole
from app.schemas.common import Page
from app.schemas.document import (
    DocumentOut,
    DocumentPreview,
    DocumentUploadResponse,
)
from app.services.audit_service import AuditService

# Documents are clinical artifacts — clinicians + admins write.
clinical_writer = Depends(require_roles(UserRole.provider, UserRole.admin))

# Reject anything beyond 25 MB so a stray upload can't fill memory.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
PREVIEW_MAX_BYTES = 1_000_000  # 1 MB

router = APIRouter(prefix="/documents", tags=["documents"])


def _eager() -> list:
    """Eager-load patient so DocumentOut can flatten the display name."""
    return [selectinload(Document.patient)]


@router.get("", response_model=Page[DocumentOut])
async def list_documents(
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth check
    q: str | None = Query(None, description="Search filename"),
    patient_id: UUID | None = None,
    category: str | None = None,
    uploaded_by: str | None = None,
    source: str | None = Query(
        None,
        description='Filter by source: "patient" for client-uploaded docs, "staff" for staff-uploaded.',
    ),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Page[DocumentOut]:
    stmt = select(Document).options(*_eager())
    count_stmt = select(func.count(Document.id))

    if q:
        like = f"%{q.strip()}%"
        cond = or_(Document.name.ilike(like), Document.summary.ilike(like))
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if patient_id is not None:
        stmt = stmt.where(Document.patient_id == patient_id)
        count_stmt = count_stmt.where(Document.patient_id == patient_id)
    if category:
        stmt = stmt.where(Document.category == category)
        count_stmt = count_stmt.where(Document.category == category)
    if uploaded_by:
        stmt = stmt.where(Document.uploaded_by == uploaded_by)
        count_stmt = count_stmt.where(Document.uploaded_by == uploaded_by)
    if source == "patient":
        stmt = stmt.where(Document.uploaded_by.like("patient:%"))
        count_stmt = count_stmt.where(Document.uploaded_by.like("patient:%"))
    elif source == "staff":
        stmt = stmt.where(
            Document.uploaded_by.is_not(None),
            ~Document.uploaded_by.like("patient:%"),
        )
        count_stmt = count_stmt.where(
            Document.uploaded_by.is_not(None),
            ~Document.uploaded_by.like("patient:%"),
        )
    if start_date is not None:
        stmt = stmt.where(Document.created_at >= start_date)
        count_stmt = count_stmt.where(Document.created_at >= start_date)
    if end_date is not None:
        stmt = stmt.where(Document.created_at < end_date)
        count_stmt = count_stmt.where(Document.created_at < end_date)

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = (
        stmt.order_by(Document.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(stmt)).scalars().unique().all()
    return Page[DocumentOut](
        items=[DocumentOut.model_validate(d) for d in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 1,
    )


@router.get("/patient/{patient_id}", response_model=list[DocumentOut])
async def list_for_patient(
    patient_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> list[DocumentOut]:
    items = (
        await db.execute(
            select(Document)
            .options(*_eager())
            .where(Document.patient_id == patient_id)
            .order_by(Document.created_at.desc())
        )
    ).scalars().unique().all()
    return [DocumentOut.model_validate(d) for d in items]


@router.get("/{doc_id}", response_model=DocumentOut)
async def get_document(
    doc_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> DocumentOut:
    doc = (
        await db.execute(
            select(Document).options(*_eager()).where(Document.id == doc_id)
        )
    ).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentOut.model_validate(doc)


@router.get("/{doc_id}/preview", response_model=DocumentPreview)
async def preview_document(
    doc_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> DocumentPreview:
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.extracted_text:
        raise HTTPException(status_code=415, detail="No text preview available")
    return DocumentPreview(
        id=doc.id, name=doc.name, mime_type=doc.mime_type, text=doc.extracted_text
    )


@router.get("/{doc_id}/download")
async def download_document(
    doc_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> Response:
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.content is None:
        raise HTTPException(
            status_code=404,
            detail="Document content is not stored — uploaded before content storage was enabled.",
        )
    filename_quoted = quote(doc.name)
    return Response(
        content=doc.content,
        media_type=doc.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{doc.name}"; filename*=UTF-8\'\'{filename_quoted}'
            ),
            "Content-Length": str(doc.size_bytes),
        },
    )


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
    category: str = Form("other"),
    file: UploadFile = File(...),
) -> DocumentUploadResponse:
    if not await db.get(Patient, patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
        )

    extracted_text: str | None = None
    if (file.content_type or "").startswith("text/") and len(contents) < PREVIEW_MAX_BYTES:
        try:
            extracted_text = contents.decode("utf-8", errors="ignore")
        except Exception:
            extracted_text = None

    doc = Document(
        patient_id=patient_id,
        name=file.filename or "uploaded",
        category=category,
        mime_type=file.content_type or "application/octet-stream",
        storage_key=f"docs/{patient_id}/{uuid4()}-{file.filename}",
        size_bytes=len(contents),
        extracted_text=extracted_text,
        uploaded_by=current.email,
        content=contents,
    )
    db.add(doc)
    await db.flush()

    # Re-fetch eagerly so the response carries patient_name + flags.
    doc = (
        await db.execute(
            select(Document).options(*_eager()).where(Document.id == doc.id)
        )
    ).scalar_one()

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


@router.delete(
    "/{doc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[clinical_writer],
)
async def delete_document(
    doc_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    patient_id = str(doc.patient_id)
    name = doc.name
    await db.delete(doc)
    await db.flush()
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="document.delete",
        resource_type="document",
        resource_id=str(doc_id),
        payload={"patient_id": patient_id, "name": name},
    )
