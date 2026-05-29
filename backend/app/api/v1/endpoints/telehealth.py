"""Telehealth endpoints (provider-side).

Patient-side endpoints live in `endpoints/patient_portal.py` to keep
the auth boundary (CurrentUser vs CurrentPatient) clear.
"""
from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.telehealth import (
    SoapDraftOut,
    TelehealthSessionOut,
    TelehealthSessionWithTokenOut,
    TranscriptBatchIn,
    TranscriptSegmentOut,
)
from app.services.soap_generator_service import SoapGeneratorService
from app.services.telehealth_service import TelehealthService
from app.services.transcript_service import TranscriptService


router = APIRouter(prefix="/telehealth", tags=["telehealth"])


@router.post(
    "/sessions/by-appointment/{appointment_id}",
    response_model=TelehealthSessionWithTokenOut,
    status_code=status.HTTP_201_CREATED,
)
async def start_or_get_session(
    appointment_id: UUID,
    db: DbSession,
    current: CurrentUser,
) -> TelehealthSessionWithTokenOut:
    """Provider clicks 'Start telehealth visit' on an appointment.
    Idempotent — returns the existing session if one is attached,
    otherwise creates a fresh room. Mints a new provider join token
    every time."""
    name = current.full_name or current.email
    session, token = await TelehealthService(db).get_or_create_for_appointment(
        appointment_id=appointment_id,
        provider_id=current.id,
        provider_name=name,
    )
    return TelehealthSessionWithTokenOut(
        **TelehealthSessionOut.model_validate(session).model_dump(),
        meeting_token=token,
    )


@router.get(
    "/sessions/{session_id}",
    response_model=TelehealthSessionOut,
)
async def get_session(
    session_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth gate
) -> TelehealthSessionOut:
    return TelehealthSessionOut.model_validate(
        await TelehealthService(db).get(session_id)
    )


@router.post("/sessions/{session_id}/end", response_model=TelehealthSessionOut)
async def end_session(
    session_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> TelehealthSessionOut:
    return TelehealthSessionOut.model_validate(
        await TelehealthService(db).end(session_id)
    )


@router.post(
    "/sessions/{session_id}/transcript",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def append_transcript(
    session_id: UUID,
    payload: TranscriptBatchIn,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> None:
    await TranscriptService(db).append_batch(session_id, payload.segments)


@router.get(
    "/sessions/{session_id}/transcript",
    response_model=list[TranscriptSegmentOut],
)
async def get_transcript(
    session_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> list[TranscriptSegmentOut]:
    rows = await TranscriptService(db).list_for_session(session_id)
    return [TranscriptSegmentOut.model_validate(r) for r in rows]


@router.post(
    "/sessions/{session_id}/generate-soap",
    response_model=SoapDraftOut,
)
async def generate_soap(
    session_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> SoapDraftOut:
    return await SoapGeneratorService(db).generate(session_id)
