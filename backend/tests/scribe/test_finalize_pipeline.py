"""Tests for FinalizePipeline.run — end-to-end happy path + failure
handling."""
from __future__ import annotations

import asyncio
import concurrent.futures

import pytest

from app.models.scribe_icd_suggestion import ScribeIcdSuggestion
from app.models.scribe_session import ScribeSessionStatus
from app.models.scribe_soap_note import ScribeSoapNote
from app.services import scribe_event_bus
from app.services.finalize_pipeline import FinalizePipeline
from sqlalchemy import select


@pytest.mark.asyncio
async def test_happy_path_persists_soap_icd_summary(
    db_session, scribe_session, seeded_icd, mock_groq
):
    scribe_session.transcript_text = "Patient reports chest pain for 3 days."
    await db_session.flush()

    await FinalizePipeline(db_session, scribe_session.id).run()

    await db_session.refresh(scribe_session)
    assert scribe_session.status == ScribeSessionStatus.completed
    assert scribe_session.completed_at is not None
    assert scribe_session.visit_summary
    assert "1 week" in scribe_session.visit_summary

    soap = (
        await db_session.execute(
            select(ScribeSoapNote).where(
                ScribeSoapNote.session_id == scribe_session.id
            )
        )
    ).scalar_one()
    assert "chest pain" in soap.subjective.lower()
    assert soap.plan

    icds = (
        await db_session.execute(
            select(ScribeIcdSuggestion).where(
                ScribeIcdSuggestion.session_id == scribe_session.id
            )
        )
    ).scalars().all()
    codes = sorted(i.code for i in icds)
    # Three codes from the canned ICD response; Z99.99 kept with
    # is_validated=False, R07.9 + I10 validated.
    assert codes == sorted(["R07.9", "I10", "Z99.99"])
    by_code = {i.code: i for i in icds}
    assert by_code["R07.9"].is_validated is True
    assert by_code["I10"].is_validated is True
    assert by_code["Z99.99"].is_validated is False


@pytest.mark.asyncio
async def test_empty_transcript_fails_cleanly(
    db_session, scribe_session, mock_groq
):
    # No transcript_text set.
    await FinalizePipeline(db_session, scribe_session.id).run()
    await db_session.refresh(scribe_session)
    assert scribe_session.status == ScribeSessionStatus.failed
    assert "empty" in (scribe_session.error_message or "").lower()


@pytest.mark.asyncio
async def test_llm_raise_marks_session_failed(
    db_session, scribe_session, mock_groq
):
    scribe_session.transcript_text = "anything"
    await db_session.flush()
    mock_groq["raise_on_chat"] = True

    await FinalizePipeline(db_session, scribe_session.id).run()
    await db_session.refresh(scribe_session)
    assert scribe_session.status == ScribeSessionStatus.failed
    assert scribe_session.error_message


@pytest.mark.asyncio
async def test_pipeline_emits_stage_events(
    db_session, scribe_session, seeded_icd, mock_groq
):
    scribe_session.transcript_text = "Patient reports chest pain."
    await db_session.flush()

    # subscribe() is synchronous (blocking on queue.get). We run it in a
    # thread so it drains events concurrently while the pipeline publishes
    # them. The pipeline's finally-close() puts the sentinel so the thread
    # exits cleanly.
    loop = asyncio.get_event_loop()
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)

    def collect_events():
        return list(scribe_event_bus.subscribe(scribe_session.id, timeout_seconds=5.0))

    # Start collecting first, THEN run the pipeline — the collector blocks
    # on the first queue.get() until an event arrives.
    future = loop.run_in_executor(executor, collect_events)
    await FinalizePipeline(db_session, scribe_session.id).run()
    events = await future
    executor.shutdown(wait=False)

    # We should have collected at least: soap-started, soap-completed,
    # icd-started, icd-completed, summary-started, summary-completed, done.
    types = [(e.get("data", {}).get("name"), e.get("data", {}).get("status"))
             for e in events if e["type"] == "stage"]
    assert ("soap", "started") in types
    assert ("soap", "completed") in types
    assert ("icd", "completed") in types
    assert ("summary", "completed") in types
    # And a final "done" event.
    assert any(e["type"] == "done" for e in events)
