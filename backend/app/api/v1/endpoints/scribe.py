"""Ambient-scribe API endpoints.

Mounted at /scribe under the v1 prefix.

Lifecycle:
  POST   /sessions                          → create session
  POST   /sessions/{id}/audio-chunk         → stream audio chunks
  GET    /sessions/{id}/stream              → SSE live transcript feed
  POST   /sessions/{id}/finalize            → trigger finalize pipeline
  GET    /sessions/{id}                     → full session payload
  GET    /patients/{patient_id}/sessions    → list sessions for a patient
  PATCH  /sessions/{id}/soap                → edit AI-drafted SOAP
  PATCH  /sessions/{id}/icd/{icd_id}        → edit / accept an ICD suggestion
  DELETE /sessions/{id}/icd/{icd_id}        → remove an ICD suggestion
  PATCH  /sessions/{id}/summary             → edit visit summary
  GET    /sessions/{id}/export.pdf          → download PDF report
"""
from __future__ import annotations

import asyncio
import json
from io import BytesIO
from datetime import datetime, timezone
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sse_starlette.sse import EventSourceResponse

from app.api.deps import CurrentUser, DbSession, get_user_from_token
from app.models.icd_catalog import IcdCatalog
from app.models.patient import Patient
from app.models.scribe_icd_suggestion import ScribeIcdSuggestion
from app.models.scribe_session import ScribeSession, ScribeSessionStatus
from app.models.scribe_soap_note import ScribeSoapNote
from app.schemas.scribe import (
    IcdSuggestionIn,
    IcdSuggestionOut,
    SessionCreate,
    SessionFull,
    SessionOut,
    SessionSummaryIn,
    SoapNoteIn,
    SoapNoteOut,
)
from app.services import scribe_event_bus
from app.services.audit_service import AuditService
from app.services.chunk_transcriber import ChunkTranscriberError, ingest_chunk
from app.services.finalize_pipeline import FinalizePipeline
from app.services.scribe_pdf import render_session_pdf

router = APIRouter(prefix="/scribe", tags=["scribe"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_session_or_404(db: DbSession, session_id: UUID) -> ScribeSession:
    session = await db.get(ScribeSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Scribe session not found")
    return session


async def _get_patient_or_404(db: DbSession, patient_id: UUID) -> Patient:
    patient = await db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


async def _run_finalize_bg(session_id: UUID) -> None:
    """Background task: opens its own DB session so the HTTP session can
    be released immediately after the endpoint returns."""
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        await FinalizePipeline(db, session_id).run()
        await db.commit()


# ---------------------------------------------------------------------------
# a) POST /sessions — create
# ---------------------------------------------------------------------------


@router.post(
    "/sessions",
    response_model=SessionOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    payload: SessionCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> SessionOut:
    await _get_patient_or_404(db, payload.patient_id)

    session = ScribeSession(
        user_id=current.id,
        patient_id=payload.patient_id,
        chief_complaint=payload.chief_complaint,
        status=ScribeSessionStatus.created,
        transcript_text="",
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="scribe.session.create",
        resource_type="scribe_session",
        resource_id=str(session.id),
        payload={
            "patient_id": str(payload.patient_id),
            "chief_complaint": payload.chief_complaint,
        },
    )
    return SessionOut.model_validate(session)


# ---------------------------------------------------------------------------
# b) POST /sessions/{session_id}/audio-chunk — multipart upload
# ---------------------------------------------------------------------------


@router.post("/sessions/{session_id}/audio-chunk")
async def upload_audio_chunk(
    session_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth only
    file: UploadFile = File(...),
    sequence: int = Form(...),
    duration_ms: int | None = Form(None),
):
    audio_bytes = await file.read()
    try:
        result = await ingest_chunk(
            db,
            session_id=session_id,
            sequence=sequence,
            audio_bytes=audio_bytes,
            filename=file.filename or "chunk.webm",
            duration_ms=duration_ms,
        )
    except ChunkTranscriberError as exc:
        msg = str(exc).lower()
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        if "completed" in msg:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result


# ---------------------------------------------------------------------------
# c) GET /sessions/{session_id}/stream — SSE live transcript
# ---------------------------------------------------------------------------


@router.get("/sessions/{session_id}/stream")
async def stream_session(
    session_id: UUID,
    db: DbSession,
    access_token: str = Query(...),
) -> EventSourceResponse:
    # Auth via query-param token (browsers can't set Bearer headers for SSE).
    await get_user_from_token(db, access_token)
    # Verify session exists.
    await _get_session_or_404(db, session_id)

    async def event_generator():
        loop = asyncio.get_event_loop()
        queue_iter = iter(
            scribe_event_bus.subscribe(session_id, timeout_seconds=60)
        )
        while True:
            evt = await loop.run_in_executor(None, lambda: next(queue_iter, None))
            if evt is None:
                break
            yield {"event": evt["type"], "data": json.dumps(evt["data"])}

    return EventSourceResponse(event_generator())


# ---------------------------------------------------------------------------
# d) POST /sessions/{session_id}/finalize
# ---------------------------------------------------------------------------


@router.post("/sessions/{session_id}/finalize")
async def finalize_session(
    session_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    db: DbSession,
    current: CurrentUser,
):
    session = await _get_session_or_404(db, session_id)

    if session.status != ScribeSessionStatus.recording:
        raise HTTPException(
            status_code=409,
            detail=f"Session status is '{session.status.value}'; must be 'recording' to finalize.",
        )
    if not session.transcript_text or not session.transcript_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Transcript is empty — nothing to finalize.",
        )

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="scribe.session.finalize",
        resource_type="scribe_session",
        resource_id=str(session_id),
    )

    background_tasks.add_task(_run_finalize_bg, session_id)
    return {"status": "queued"}


# ---------------------------------------------------------------------------
# e) GET /sessions/{session_id} — full payload
# ---------------------------------------------------------------------------


@router.get("/sessions/{session_id}", response_model=SessionFull)
async def get_session(
    session_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> SessionFull:
    result = (
        await db.execute(
            select(ScribeSession)
            .options(
                selectinload(ScribeSession.transcripts),
                selectinload(ScribeSession.soap_note),
                selectinload(ScribeSession.icd_suggestions),
            )
            .where(ScribeSession.id == session_id)
        )
    ).scalar_one_or_none()
    if result is None:
        raise HTTPException(status_code=404, detail="Scribe session not found")
    return SessionFull.model_validate(result)


# ---------------------------------------------------------------------------
# f) GET /patients/{patient_id}/sessions — list patient sessions
# ---------------------------------------------------------------------------


@router.get("/patients/{patient_id}/sessions", response_model=list[SessionOut])
async def list_patient_sessions(
    patient_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> list[SessionOut]:
    await _get_patient_or_404(db, patient_id)

    rows = (
        await db.execute(
            select(ScribeSession)
            .where(ScribeSession.patient_id == patient_id)
            .order_by(ScribeSession.started_at.desc())
        )
    ).scalars().all()
    return [SessionOut.model_validate(r) for r in rows]


# ---------------------------------------------------------------------------
# g) PATCH /sessions/{session_id}/soap — edit SOAP
# ---------------------------------------------------------------------------


@router.patch("/sessions/{session_id}/soap", response_model=SoapNoteOut)
async def patch_soap(
    session_id: UUID,
    payload: SoapNoteIn,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> SoapNoteOut:
    await _get_session_or_404(db, session_id)

    soap = (
        await db.execute(
            select(ScribeSoapNote).where(ScribeSoapNote.session_id == session_id)
        )
    ).scalar_one_or_none()
    if soap is None:
        raise HTTPException(status_code=404, detail="SOAP note not found for this session")

    update = payload.model_dump(exclude_none=True)
    for field, value in update.items():
        setattr(soap, field, value)
    soap.edited_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(soap)

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="scribe.soap.edit",
        resource_type="scribe_session",
        resource_id=str(session_id),
        payload=update,
    )
    return SoapNoteOut.model_validate(soap)


# ---------------------------------------------------------------------------
# h) PATCH /sessions/{session_id}/icd/{icd_id} — edit ICD suggestion
# ---------------------------------------------------------------------------


@router.patch(
    "/sessions/{session_id}/icd/{icd_id}", response_model=IcdSuggestionOut
)
async def patch_icd(
    session_id: UUID,
    icd_id: UUID,
    payload: IcdSuggestionIn,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> IcdSuggestionOut:
    await _get_session_or_404(db, session_id)

    suggestion = (
        await db.execute(
            select(ScribeIcdSuggestion).where(
                ScribeIcdSuggestion.id == icd_id,
                ScribeIcdSuggestion.session_id == session_id,
            )
        )
    ).scalar_one_or_none()
    if suggestion is None:
        raise HTTPException(status_code=404, detail="ICD suggestion not found")

    update = payload.model_dump(exclude_none=True)

    # If code changed, re-validate against catalog.
    new_code = update.get("code")
    if new_code is not None and new_code.strip().upper() != suggestion.code.upper():
        normalised = new_code.strip().upper()
        catalog_row = (
            await db.execute(
                select(IcdCatalog).where(IcdCatalog.code == normalised)
            )
        ).scalar_one_or_none()
        suggestion.code = normalised
        if catalog_row is not None:
            suggestion.description = catalog_row.short_description
            suggestion.is_validated = True
        else:
            suggestion.is_validated = False
        # Remove code/description from update dict — already applied above.
        update.pop("code", None)
        update.pop("description", None)

    for field, value in update.items():
        setattr(suggestion, field, value)

    await db.flush()
    await db.refresh(suggestion)

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="scribe.icd.edit",
        resource_type="scribe_session",
        resource_id=str(session_id),
        payload={"icd_id": str(icd_id), **payload.model_dump(exclude_none=True)},
    )
    return IcdSuggestionOut.model_validate(suggestion)


# ---------------------------------------------------------------------------
# i) DELETE /sessions/{session_id}/icd/{icd_id}
# ---------------------------------------------------------------------------


@router.delete(
    "/sessions/{session_id}/icd/{icd_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_icd(
    session_id: UUID,
    icd_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    await _get_session_or_404(db, session_id)

    suggestion = (
        await db.execute(
            select(ScribeIcdSuggestion).where(
                ScribeIcdSuggestion.id == icd_id,
                ScribeIcdSuggestion.session_id == session_id,
            )
        )
    ).scalar_one_or_none()
    if suggestion is None:
        raise HTTPException(status_code=404, detail="ICD suggestion not found")

    await db.delete(suggestion)
    await db.flush()

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="scribe.icd.delete",
        resource_type="scribe_session",
        resource_id=str(session_id),
        payload={"icd_id": str(icd_id)},
    )


# ---------------------------------------------------------------------------
# j) PATCH /sessions/{session_id}/summary
# ---------------------------------------------------------------------------


@router.patch("/sessions/{session_id}/summary", response_model=SessionOut)
async def patch_summary(
    session_id: UUID,
    payload: SessionSummaryIn,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> SessionOut:
    session = await _get_session_or_404(db, session_id)
    session.visit_summary = payload.visit_summary
    await db.flush()
    await db.refresh(session)

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="scribe.summary.edit",
        resource_type="scribe_session",
        resource_id=str(session_id),
        payload={"visit_summary_len": len(payload.visit_summary)},
    )
    return SessionOut.model_validate(session)


# ---------------------------------------------------------------------------
# k) GET /sessions/{session_id}/export.pdf
# ---------------------------------------------------------------------------


@router.get("/sessions/{session_id}/export.pdf")
async def export_pdf(
    session_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> Response:
    result = (
        await db.execute(
            select(ScribeSession)
            .options(
                selectinload(ScribeSession.soap_note),
                selectinload(ScribeSession.icd_suggestions),
            )
            .where(ScribeSession.id == session_id)
        )
    ).scalar_one_or_none()
    if result is None:
        raise HTTPException(status_code=404, detail="Scribe session not found")

    patient = await db.get(Patient, result.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    pdf_bytes = render_session_pdf(result, patient)

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="scribe.session.export_pdf",
        resource_type="scribe_session",
        resource_id=str(session_id),
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="scribe-{session_id}.pdf"'
        },
    )
