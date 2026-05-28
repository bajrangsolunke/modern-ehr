"""Test fixtures for the scribe pipeline. Mocks Groq (STT + LLM) so
no test ever hits the real API. The mocked llm_client.chat routes by
system-prompt keyword so a single fixture covers SOAP, ICD, and
summary calls."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.models.icd_catalog import IcdCatalog
from app.models.scribe_session import ScribeSession, ScribeSessionStatus
from app.services import scribe_event_bus


DEFAULT_TRANSCRIPT = "Patient reports chest pain for 3 days."

DEFAULT_SOAP = {
    "subjective": "Patient reports 3-day history of chest pain.",
    "objective": "BP 130/85, HR 78, afebrile.",
    "assessment": "Suspected musculoskeletal chest pain.",
    "plan": "Ibuprofen 400 mg q6h prn; ECG; follow up in 1 week.",
}

DEFAULT_ICD = {
    "suggestions": [
        {
            "code": "R07.9",
            "description": "Chest pain, unspecified",
            "confidence": 0.85,
            "reasoning": "Documented chest pain on Assessment line.",
        },
        {
            "code": "I10",
            "description": "Essential (primary) hypertension",
            "confidence": 0.45,
            "reasoning": "BP elevated on Objective line.",
        },
        # An unknown code that should be kept with is_validated=False
        {
            "code": "Z99.99",
            "description": "Made-up code",
            "confidence": 0.3,
            "reasoning": "Not in catalog — should be flagged.",
        },
    ]
}

DEFAULT_SUMMARY = {
    "summary": "You came in today with 3 days of chest pain. Your exam was reassuring and your doctor recommends taking ibuprofen as needed and following up in 1 week if symptoms persist."
}


@pytest.fixture(autouse=True)
def mock_groq(monkeypatch):
    """Replace stt.transcribe + llm_client.chat with canned-response
    stubs. Yields a dict so individual tests can override the per-call
    response via mock_groq["stt"] = "..." / mock_groq["soap"] = {...}."""
    state: dict[str, Any] = {
        "stt": DEFAULT_TRANSCRIPT,
        "soap": DEFAULT_SOAP,
        "icd": DEFAULT_ICD,
        "summary": DEFAULT_SUMMARY,
        "raise_on_chat": False,
    }

    async def fake_transcribe(audio_bytes: bytes, filename: str, language: str = "en") -> str:
        return state["stt"]

    async def fake_chat(messages, *, model=None, temperature=0.2, max_tokens=600, json_mode=False) -> str:
        if state["raise_on_chat"]:
            raise RuntimeError("LLM intentionally raised by test")
        # Route by system prompt content — check most-specific patterns first.
        # The summary prompt ALSO contains "clinical scribe" so it must be
        # tested before the SOAP check to avoid a false match.
        system = (messages[0].get("content") or "") if messages else ""
        if "visit summary" in system.lower() or "patient-facing" in system.lower():
            return json.dumps(state["summary"])
        if "ICD" in system or "coding assistant" in system.lower():
            return json.dumps(state["icd"])
        if "SOAP note" in system or "clinical scribe" in system.lower():
            return json.dumps(state["soap"])
        # Fallback
        return json.dumps(state["soap"])

    monkeypatch.setattr("app.ai.stt.transcribe", fake_transcribe)
    monkeypatch.setattr(
        "app.ai.llm.llm_client.chat",
        fake_chat,
    )

    yield state

    # Cleanup the per-session event-bus queues so they don't leak
    # between tests.
    scribe_event_bus.reset_for_tests()


# ---------------------------------------------------------------------------
# HTTP client + auth helpers for endpoint tests
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def client(db_session):
    """Authenticated httpx async client backed by the FastAPI app, with
    DbSession dep overridden to use the test transaction session."""
    from app.db.session import get_db
    from app.main import app

    async def _override():
        yield db_session

    app.dependency_overrides[get_db] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(provider_user):
    from jose import jwt

    from app.core.config import settings

    payload = {
        "sub": str(provider_user.id),
        "type": "access",
        "token_type": "user",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def scribe_session(db_session, sample_patient, provider_user):
    """A scribe session in `recording` state, tied to the sample patient
    and an unsaved transcript."""
    row = ScribeSession(
        user_id=provider_user.id,
        patient_id=sample_patient.id,
        chief_complaint="Chest pain",
        status=ScribeSessionStatus.recording,
        transcript_text="",
    )
    db_session.add(row)
    await db_session.flush()
    return row


@pytest_asyncio.fixture
async def seeded_icd(db_session):
    """Subset of icd_catalog. The validator uses this to mark
    suggestions is_validated=True for known codes."""
    seeds = [
        IcdCatalog(code="R07.9", short_description="Chest pain, unspecified", chapter="Symptoms"),
        IcdCatalog(code="I10", short_description="Essential (primary) hypertension", chapter="Circulatory"),
        IcdCatalog(code="E11.9", short_description="Type 2 diabetes mellitus without complications", chapter="Endocrine"),
    ]
    # Use insert with on-conflict-do-nothing so we don't collide with
    # rows the outer seed may have added.
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    for s in seeds:
        await db_session.execute(
            pg_insert(IcdCatalog)
            .values(
                code=s.code,
                short_description=s.short_description,
                chapter=s.chapter,
            )
            .on_conflict_do_nothing(index_elements=["code"])
        )
    await db_session.flush()
    return seeds
