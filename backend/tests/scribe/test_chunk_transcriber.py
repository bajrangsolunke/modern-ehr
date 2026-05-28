"""Tests for chunk_transcriber.ingest_chunk."""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.models.scribe_session import ScribeSessionStatus
from app.models.scribe_transcript import ScribeTranscript
from app.services import scribe_event_bus
from app.services.chunk_transcriber import (
    ChunkTranscriberError,
    ingest_chunk,
)
from sqlalchemy import select


@pytest.mark.asyncio
async def test_first_chunk_creates_row_and_transitions_status(
    db_session, scribe_session, mock_groq
):
    res = await ingest_chunk(
        db_session,
        session_id=scribe_session.id,
        sequence=0,
        audio_bytes=b"<fake webm>",
        filename="chunk-0.webm",
        duration_ms=4000,
    )
    assert res.text == mock_groq["stt"]
    assert res.transcript_so_far == mock_groq["stt"]

    await db_session.refresh(scribe_session)
    # Already recording → stays recording.
    assert scribe_session.status == ScribeSessionStatus.recording
    assert scribe_session.transcript_text == mock_groq["stt"]

    rows = (
        await db_session.execute(
            select(ScribeTranscript).where(
                ScribeTranscript.session_id == scribe_session.id
            )
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_duplicate_sequence_is_idempotent(
    db_session, scribe_session, mock_groq
):
    await ingest_chunk(
        db_session,
        session_id=scribe_session.id,
        sequence=0,
        audio_bytes=b"<a>",
        filename="a.webm",
    )
    # Second call with same sequence shouldn't re-transcribe or
    # double-append the transcript_text.
    mock_groq["stt"] = "DIFFERENT TEXT"  # Different STT output for this run
    res = await ingest_chunk(
        db_session,
        session_id=scribe_session.id,
        sequence=0,
        audio_bytes=b"<a>",
        filename="a.webm",
    )
    # Returned text is the ORIGINAL transcription, not the new one.
    assert res.text != "DIFFERENT TEXT"

    await db_session.refresh(scribe_session)
    # Only one chunk's worth of text persisted.
    assert scribe_session.transcript_text.count(res.text) == 1


@pytest.mark.asyncio
async def test_out_of_order_sequences_append(
    db_session, scribe_session, mock_groq
):
    mock_groq["stt"] = "First chunk."
    await ingest_chunk(
        db_session,
        session_id=scribe_session.id,
        sequence=0,
        audio_bytes=b"<a>",
        filename="a.webm",
    )
    mock_groq["stt"] = "Second chunk."
    await ingest_chunk(
        db_session,
        session_id=scribe_session.id,
        sequence=2,  # skip 1 — we still want to record
        audio_bytes=b"<c>",
        filename="c.webm",
    )
    await db_session.refresh(scribe_session)
    # The transcript appends in CALL order (not sequence order). That's
    # fine — `sequence` is the chunk audit number, `transcript_text` is
    # the readable encounter prose.
    assert "First chunk." in scribe_session.transcript_text
    assert "Second chunk." in scribe_session.transcript_text


@pytest.mark.asyncio
async def test_empty_stt_does_not_append_or_event(
    db_session, scribe_session, mock_groq
):
    mock_groq["stt"] = ""
    res = await ingest_chunk(
        db_session,
        session_id=scribe_session.id,
        sequence=0,
        audio_bytes=b"<silence>",
        filename="silence.webm",
    )
    assert res.text == ""
    await db_session.refresh(scribe_session)
    assert scribe_session.transcript_text == ""
    # Event bus shouldn't have anything for this session.
    assert scribe_event_bus.queue_size(scribe_session.id) == 0


@pytest.mark.asyncio
async def test_missing_session_raises(db_session, mock_groq):
    with pytest.raises(ChunkTranscriberError):
        await ingest_chunk(
            db_session,
            session_id=uuid4(),
            sequence=0,
            audio_bytes=b"<x>",
            filename="x.webm",
        )


@pytest.mark.asyncio
async def test_completed_session_rejects_chunks(
    db_session, scribe_session, mock_groq
):
    scribe_session.status = ScribeSessionStatus.completed
    await db_session.flush()
    with pytest.raises(ChunkTranscriberError):
        await ingest_chunk(
            db_session,
            session_id=scribe_session.id,
            sequence=99,
            audio_bytes=b"<x>",
            filename="x.webm",
        )
