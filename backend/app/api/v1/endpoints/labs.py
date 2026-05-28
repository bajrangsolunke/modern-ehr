from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.ai.llm import llm_client
from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.lab_result import LabResult
from app.models.user import UserRole
from app.schemas.lab import (
    LabBatchCreate,
    LabCreate,
    LabExtractionPreviewOut,
    LabOut,
)
from app.services.audit_service import AuditService
from app.services.lab_extraction_service import LabExtractionService

# Labs come from clinicians or admin imports.
clinical_writer = Depends(require_roles(UserRole.provider, UserRole.admin))

router = APIRouter(prefix="/labs", tags=["labs"])


@router.get("/patient/{patient_id}", response_model=list[LabOut])
async def list_for_patient(
    patient_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth check
) -> list[LabOut]:
    result = await db.execute(
        select(LabResult)
        .where(LabResult.patient_id == patient_id)
        .options(selectinload(LabResult.source_document))
        .order_by(LabResult.collected_at.desc())
    )
    rows = result.scalars().all()
    out = []
    for lab in rows:
        lab_dict = {
            "id": lab.id,
            "patient_id": lab.patient_id,
            "name": lab.name,
            "value": lab.value,
            "unit": lab.unit,
            "loinc": lab.loinc,
            "reference_range": lab.reference_range,
            "flag": lab.flag,
            "collected_at": lab.collected_at,
            "source_document_id": lab.source_document_id,
            "source_document_name": lab.source_document.name if lab.source_document else None,
        }
        out.append(LabOut.model_validate(lab_dict))
    return out


@router.post(
    "",
    response_model=LabOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[clinical_writer],
)
async def create_lab(
    payload: LabCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> LabOut:
    lab = LabResult(**payload.model_dump())
    db.add(lab)
    await db.flush()
    await db.refresh(lab)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="lab.create",
        resource_type="lab_result",
        resource_id=str(lab.id),
        payload={"patient_id": str(lab.patient_id), "name": lab.name},
    )
    return LabOut.model_validate(
        {
            "id": lab.id,
            "patient_id": lab.patient_id,
            "name": lab.name,
            "value": lab.value,
            "unit": lab.unit,
            "loinc": lab.loinc,
            "reference_range": lab.reference_range,
            "flag": lab.flag,
            "collected_at": lab.collected_at,
            "source_document_id": lab.source_document_id,
            "source_document_name": None,
        }
    )


@router.post("/extract/{document_id}/preview", response_model=LabExtractionPreviewOut)
async def preview_extraction(
    document_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> LabExtractionPreviewOut:
    doc, batch = await LabExtractionService(db).extract_from_document(document_id)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="lab.extract.preview",
        resource_type="document",
        resource_id=str(document_id),
        payload={
            "model": llm_client.chat_model,
            "extracted_count": len(batch.results),
        },
    )
    return LabExtractionPreviewOut(
        document_id=doc.id,
        document_name=doc.name,
        patient_id=doc.patient_id,
        model=llm_client.chat_model,
        results=batch.results,
    )


@router.post(
    "/batch",
    response_model=list[LabOut],
    status_code=status.HTTP_201_CREATED,
    dependencies=[clinical_writer],
)
async def batch_create_labs(
    payload: LabBatchCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> list[LabOut]:
    # Verify patient exists (raises 404 if not via SQLAlchemy .get returning None)
    from app.models.patient import Patient
    from fastapi import HTTPException

    patient = await db.get(Patient, payload.patient_id)
    if patient is None:
        raise HTTPException(404, "Patient not found")

    created = []
    for row in payload.results:
        lab = LabResult(
            patient_id=payload.patient_id,
            source_document_id=payload.source_document_id,
            name=row.name,
            value=row.value,
            unit=row.unit,
            reference_range=row.reference_range,
            flag=row.flag,
        )
        db.add(lab)
        created.append(lab)

    await db.flush()
    for lab in created:
        await db.refresh(lab)

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="lab.batch.create",
        resource_type="lab_result",
        resource_id=None,
        payload={
            "patient_id": str(payload.patient_id),
            "source_document_id": str(payload.source_document_id) if payload.source_document_id else None,
            "count": len(created),
        },
    )

    # Load source document name if needed
    source_doc_name: str | None = None
    if payload.source_document_id:
        from app.models.document import Document
        doc = await db.get(Document, payload.source_document_id)
        source_doc_name = doc.name if doc else None

    return [
        LabOut.model_validate(
            {
                "id": lab.id,
                "patient_id": lab.patient_id,
                "name": lab.name,
                "value": lab.value,
                "unit": lab.unit,
                "loinc": lab.loinc,
                "reference_range": lab.reference_range,
                "flag": lab.flag,
                "collected_at": lab.collected_at,
                "source_document_id": lab.source_document_id,
                "source_document_name": source_doc_name,
            }
        )
        for lab in created
    ]
