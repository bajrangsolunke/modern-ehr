"""Per-chunk transcription service for the live scribe pipeline.

The HTTP endpoint (added in Phase 2) receives a multipart audio chunk
+ sequence number and calls `ingest_chunk(...)`. We:
  1. Transcribe via app.ai.stt.transcribe
  2. Persist a ScribeTranscript row (idempotent on (session_id, sequence))
  3. Append the fragment to scribe_session.transcript_text
  4. Publish a "transcript" event on the per-session bus
  5. Return the new fragment + total transcript

If Whisper returns an empty string we still create the audit row (so
the per-chunk sequence stays continuous) but DO NOT append to the
denormalized transcript or fire an event — silence is silence."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import stt
from app.models.scribe_session import ScribeSession, ScribeSessionStatus
from app.models.scribe_transcript import ScribeTranscript
from app.schemas.scribe import ChunkUploadResponse
from app.services import scribe_event_bus


class ChunkTranscriberError(Exception):
    """Raised when a chunk can't be ingested for a reason the caller
    needs to surface (session missing, status wrong, duplicate sequence
    with conflicting payload, etc.). Empty-transcript cases are NOT
    errors — they return a normal response with an empty fragment."""


async def ingest_chunk(
    db: AsyncSession,
    *,
    session_id: UUID,
    sequence: int,
    audio_bytes: bytes,
    filename: str,
    duration_ms: int | None = None,
) -> ChunkUploadResponse:
    session = await db.get(ScribeSession, session_id)
    if session is None:
        raise ChunkTranscriberError(f"Scribe session {session_id} not found")
    if session.status == ScribeSessionStatus.completed:
        raise ChunkTranscriberError(
            f"Session {session_id} is already completed — no more chunks accepted"
        )

    # Idempotency: if this sequence already exists for this session,
    # return the existing fragment instead of re-transcribing.
    existing = (
        await db.execute(
            select(ScribeTranscript).where(
                ScribeTranscript.session_id == session_id,
                ScribeTranscript.sequence == sequence,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return ChunkUploadResponse(
            sequence=existing.sequence,
            text=existing.text,
            transcript_so_far=session.transcript_text or "",
        )

    # Transition status on first chunk (created → recording).
    if session.status == ScribeSessionStatus.created:
        session.status = ScribeSessionStatus.recording

    text = await stt.transcribe(audio_bytes, filename)

    row = ScribeTranscript(
        session_id=session_id,
        sequence=sequence,
        text=text,
        duration_ms=duration_ms,
    )
    db.add(row)

    if text:
        # Append with a leading space so consecutive chunks read as
        # one paragraph. Empty text → skip the append + skip the event.
        prefix = " " if session.transcript_text else ""
        session.transcript_text = (session.transcript_text or "") + prefix + text

    await db.flush()
    await db.refresh(row)

    if text:
        scribe_event_bus.publish(
            session_id,
            "transcript",
            {
                "sequence": sequence,
                "text": text,
                "transcript_so_far": session.transcript_text,
            },
        )

    return ChunkUploadResponse(
        sequence=sequence,
        text=text,
        transcript_so_far=session.transcript_text or "",
    )
