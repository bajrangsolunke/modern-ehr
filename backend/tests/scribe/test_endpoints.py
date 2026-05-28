"""Integration tests for the scribe API endpoints (Phase 2).

Uses the existing mock_groq autouse fixture so no real AI calls are made.
All tests run inside a rolled-back DB transaction (db_session fixture).
"""
from __future__ import annotations

import pytest
import pytest_asyncio

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# POST /sessions — create
# ---------------------------------------------------------------------------


async def test_create_session_201(client, auth_headers, sample_patient):
    r = await client.post(
        "/api/v1/scribe/sessions",
        json={"patient_id": str(sample_patient.id), "chief_complaint": "Chest pain"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["patient_id"] == str(sample_patient.id)
    assert body["status"] == "created"


async def test_create_session_404_for_missing_patient(client, auth_headers):
    from uuid import uuid4

    r = await client.post(
        "/api/v1/scribe/sessions",
        json={"patient_id": str(uuid4())},
        headers=auth_headers,
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST /sessions/:id/audio-chunk
# ---------------------------------------------------------------------------


async def test_audio_chunk_idempotent(client, auth_headers, scribe_session):
    r1 = await client.post(
        f"/api/v1/scribe/sessions/{scribe_session.id}/audio-chunk",
        files={"file": ("c.webm", b"<audio>", "audio/webm")},
        data={"sequence": "0", "duration_ms": "4000"},
        headers=auth_headers,
    )
    assert r1.status_code == 200
    body1 = r1.json()

    # Second call with same sequence returns the same fragment.
    r2 = await client.post(
        f"/api/v1/scribe/sessions/{scribe_session.id}/audio-chunk",
        files={"file": ("c.webm", b"<audio>", "audio/webm")},
        data={"sequence": "0"},
        headers=auth_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["text"] == body1["text"]


async def test_audio_chunk_404_for_missing_session(client, auth_headers):
    from uuid import uuid4

    r = await client.post(
        f"/api/v1/scribe/sessions/{uuid4()}/audio-chunk",
        files={"file": ("c.webm", b"<audio>", "audio/webm")},
        data={"sequence": "0"},
        headers=auth_headers,
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST /sessions/:id/finalize
# ---------------------------------------------------------------------------


async def test_finalize_requires_recording(
    client, auth_headers, scribe_session, db_session
):
    # Fixture starts in `recording` state; add transcript to satisfy empty check.
    scribe_session.transcript_text = "Patient reports chest pain."
    await db_session.flush()

    r = await client.post(
        f"/api/v1/scribe/sessions/{scribe_session.id}/finalize",
        headers=auth_headers,
    )
    assert r.status_code in (200, 202)


async def test_finalize_409_when_completed(
    client, auth_headers, scribe_session, db_session
):
    scribe_session.status = ScribeSessionStatus.completed
    await db_session.flush()

    r = await client.post(
        f"/api/v1/scribe/sessions/{scribe_session.id}/finalize",
        headers=auth_headers,
    )
    assert r.status_code == 409


async def test_finalize_400_when_transcript_empty(client, auth_headers, scribe_session):
    # transcript_text is "" by fixture
    r = await client.post(
        f"/api/v1/scribe/sessions/{scribe_session.id}/finalize",
        headers=auth_headers,
    )
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# GET /sessions/:id
# ---------------------------------------------------------------------------


async def test_get_session_full_404(client, auth_headers):
    from uuid import uuid4

    r = await client.get(
        f"/api/v1/scribe/sessions/{uuid4()}",
        headers=auth_headers,
    )
    assert r.status_code == 404


async def test_get_session_full_includes_children(
    client, auth_headers, scribe_session, seeded_icd, db_session
):
    from app.models.scribe_icd_suggestion import ScribeIcdSuggestion
    from app.models.scribe_soap_note import ScribeSoapNote

    db_session.add(
        ScribeSoapNote(
            session_id=scribe_session.id,
            subjective="s",
            objective="o",
            assessment="a",
            plan="p",
        )
    )
    db_session.add(
        ScribeIcdSuggestion(
            session_id=scribe_session.id,
            code="R07.9",
            description="Chest pain",
            confidence=0.8,
            is_validated=True,
        )
    )
    await db_session.flush()

    r = await client.get(
        f"/api/v1/scribe/sessions/{scribe_session.id}",
        headers=auth_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["soap_note"]["subjective"] == "s"
    assert len(body["icd_suggestions"]) == 1
    assert body["icd_suggestions"][0]["code"] == "R07.9"


# ---------------------------------------------------------------------------
# GET /patients/:id/sessions
# ---------------------------------------------------------------------------


async def test_list_patient_sessions(client, auth_headers, sample_patient, scribe_session):
    r = await client.get(
        f"/api/v1/scribe/patients/{sample_patient.id}/sessions",
        headers=auth_headers,
    )
    assert r.status_code == 200
    rows = r.json()
    assert any(row["id"] == str(scribe_session.id) for row in rows)


async def test_list_patient_sessions_404_missing_patient(client, auth_headers):
    from uuid import uuid4

    r = await client.get(
        f"/api/v1/scribe/patients/{uuid4()}/sessions",
        headers=auth_headers,
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /sessions/:id/soap
# ---------------------------------------------------------------------------


async def test_patch_soap(client, auth_headers, scribe_session, db_session):
    from app.models.scribe_soap_note import ScribeSoapNote

    db_session.add(ScribeSoapNote(session_id=scribe_session.id, subjective="orig"))
    await db_session.flush()

    r = await client.patch(
        f"/api/v1/scribe/sessions/{scribe_session.id}/soap",
        json={"subjective": "edited"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["subjective"] == "edited"
    assert r.json()["edited_at"] is not None


async def test_patch_soap_404_when_no_note(client, auth_headers, scribe_session):
    # No SOAP note created — should return 404.
    r = await client.patch(
        f"/api/v1/scribe/sessions/{scribe_session.id}/soap",
        json={"subjective": "x"},
        headers=auth_headers,
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /sessions/:id/icd/:icd_id
# ---------------------------------------------------------------------------


async def test_patch_icd_revalidates_on_code_change(
    client, auth_headers, scribe_session, seeded_icd, db_session
):
    from app.models.scribe_icd_suggestion import ScribeIcdSuggestion

    sug = ScribeIcdSuggestion(
        session_id=scribe_session.id,
        code="ZZZ.99",
        description="unknown",
        confidence=0.5,
        is_validated=False,
    )
    db_session.add(sug)
    await db_session.flush()

    r = await client.patch(
        f"/api/v1/scribe/sessions/{scribe_session.id}/icd/{sug.id}",
        json={"code": "I10"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == "I10"
    assert body["is_validated"] is True
    # Catalog description should win
    assert "hypertension" in body["description"].lower()


async def test_patch_icd_accept(client, auth_headers, scribe_session, db_session):
    from app.models.scribe_icd_suggestion import ScribeIcdSuggestion

    sug = ScribeIcdSuggestion(
        session_id=scribe_session.id,
        code="R07.9",
        description="Chest pain",
        confidence=0.8,
        accepted_by_user=False,
    )
    db_session.add(sug)
    await db_session.flush()

    r = await client.patch(
        f"/api/v1/scribe/sessions/{scribe_session.id}/icd/{sug.id}",
        json={"accepted_by_user": True},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["accepted_by_user"] is True


# ---------------------------------------------------------------------------
# DELETE /sessions/:id/icd/:icd_id
# ---------------------------------------------------------------------------


async def test_delete_icd(client, auth_headers, scribe_session, db_session):
    from app.models.scribe_icd_suggestion import ScribeIcdSuggestion

    sug = ScribeIcdSuggestion(
        session_id=scribe_session.id,
        code="R07.9",
        description="x",
        confidence=0.5,
    )
    db_session.add(sug)
    await db_session.flush()

    r = await client.delete(
        f"/api/v1/scribe/sessions/{scribe_session.id}/icd/{sug.id}",
        headers=auth_headers,
    )
    assert r.status_code == 204


async def test_delete_icd_404(client, auth_headers, scribe_session):
    from uuid import uuid4

    r = await client.delete(
        f"/api/v1/scribe/sessions/{scribe_session.id}/icd/{uuid4()}",
        headers=auth_headers,
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /sessions/:id/summary
# ---------------------------------------------------------------------------


async def test_patch_summary(client, auth_headers, scribe_session):
    r = await client.patch(
        f"/api/v1/scribe/sessions/{scribe_session.id}/summary",
        json={"visit_summary": "Edited."},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["visit_summary"] == "Edited."


# ---------------------------------------------------------------------------
# GET /sessions/:id/export.pdf
# ---------------------------------------------------------------------------


async def test_export_pdf_returns_bytes(
    client, auth_headers, scribe_session, db_session
):
    from app.models.scribe_soap_note import ScribeSoapNote

    db_session.add(ScribeSoapNote(session_id=scribe_session.id, subjective="s"))
    await db_session.flush()

    r = await client.get(
        f"/api/v1/scribe/sessions/{scribe_session.id}/export.pdf",
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    assert r.content[:4] == b"%PDF"


async def test_export_pdf_404_for_missing_session(client, auth_headers):
    from uuid import uuid4

    r = await client.get(
        f"/api/v1/scribe/sessions/{uuid4()}/export.pdf",
        headers=auth_headers,
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Unauthenticated / missing auth
# ---------------------------------------------------------------------------


async def test_create_session_requires_auth(client, sample_patient):
    r = await client.post(
        "/api/v1/scribe/sessions",
        json={"patient_id": str(sample_patient.id)},
    )
    assert r.status_code == 401


# Keep import accessible in test body
from app.models.scribe_session import ScribeSessionStatus  # noqa: E402
