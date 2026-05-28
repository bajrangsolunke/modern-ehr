"""Tests for the AI lab extraction pipeline and batch-create endpoint."""
from __future__ import annotations

import uuid
from io import BytesIO

import pytest

from app.models.document import Document


# ---------------------------------------------------------------------------
# Helper: create a minimal in-memory PDF with known lab text
# ---------------------------------------------------------------------------

def _make_lab_pdf(text: str) -> bytes:
    """Create a minimal PDF containing `text` using reportlab."""
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    # Write each line separately for reliable text extraction
    y = 750
    for line in text.splitlines():
        c.drawString(72, y, line)
        y -= 20
    c.save()
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_preview_from_pdf_returns_extracted_rows(
    client, auth_headers, db_session, sample_patient
):
    """POST /labs/extract/{doc_id}/preview returns the mocked lab rows."""
    # Create a document with PDF content
    pdf_bytes = _make_lab_pdf("HbA1c: 6.5%\nBP: 142/88\nINR: 1.2")
    doc = Document(
        patient_id=sample_patient.id,
        name="lab_report.pdf",
        category="lab",
        mime_type="application/pdf",
        storage_key="test/lab_report.pdf",
        size_bytes=len(pdf_bytes),
        content=pdf_bytes,
    )
    db_session.add(doc)
    await db_session.flush()
    await db_session.refresh(doc)

    resp = await client.post(
        f"/api/v1/labs/extract/{doc.id}/preview",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["document_id"] == str(doc.id)
    assert body["document_name"] == "lab_report.pdf"
    assert body["patient_id"] == str(sample_patient.id)
    # The mock returns 3 rows
    assert len(body["results"]) == 3
    names = [r["name"] for r in body["results"]]
    assert "HbA1c" in names


@pytest.mark.asyncio
async def test_preview_404_when_document_missing(client, auth_headers):
    """POST /labs/extract/{random_id}/preview → 404 when doc absent."""
    random_id = uuid.uuid4()
    resp = await client.post(
        f"/api/v1/labs/extract/{random_id}/preview",
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_preview_422_when_no_content(
    client, auth_headers, db_session, sample_patient
):
    """POST /labs/extract/{doc_id}/preview → 422 when content is None."""
    doc = Document(
        patient_id=sample_patient.id,
        name="empty_report.pdf",
        category="lab",
        mime_type="application/pdf",
        storage_key="test/empty_report.pdf",
        size_bytes=0,
        content=None,  # no stored bytes
    )
    db_session.add(doc)
    await db_session.flush()
    await db_session.refresh(doc)

    resp = await client.post(
        f"/api/v1/labs/extract/{doc.id}/preview",
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_batch_create_persists_labs_with_source_doc(
    client, auth_headers, db_session, sample_patient
):
    """POST /labs/batch creates rows and links them to source_document_id."""
    doc = Document(
        patient_id=sample_patient.id,
        name="results.pdf",
        category="lab",
        mime_type="application/pdf",
        storage_key="test/results.pdf",
        size_bytes=100,
        content=b"%PDF-minimal",
    )
    db_session.add(doc)
    await db_session.flush()
    await db_session.refresh(doc)

    payload = {
        "patient_id": str(sample_patient.id),
        "source_document_id": str(doc.id),
        "results": [
            {"name": "HbA1c", "value": "6.5", "unit": "%", "reference_range": "4.0-5.6", "flag": "H"},
            {"name": "INR", "value": "1.2", "unit": None, "reference_range": None, "flag": None},
        ],
    }
    resp = await client.post(
        "/api/v1/labs/batch",
        json=payload,
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    rows = resp.json()
    assert len(rows) == 2
    for row in rows:
        assert row["source_document_id"] == str(doc.id)
        assert row["source_document_name"] == "results.pdf"
    names = {r["name"] for r in rows}
    assert names == {"HbA1c", "INR"}


@pytest.mark.asyncio
async def test_batch_create_404_when_patient_missing(
    client, auth_headers
):
    """POST /labs/batch → 404 when patient_id doesn't exist."""
    payload = {
        "patient_id": str(uuid.uuid4()),
        "results": [
            {"name": "HbA1c", "value": "6.5"},
        ],
    }
    resp = await client.post(
        "/api/v1/labs/batch",
        json=payload,
        headers=auth_headers,
    )
    assert resp.status_code == 404
