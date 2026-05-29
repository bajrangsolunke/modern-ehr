"""Tests for POST /api/v1/ai/icd-suggest.

Reuses the shared mock_groq autouse fixture from tests/scribe/conftest.py
(imported via conftest cascade) and the root fixtures db_session,
provider_user, seeded_icd.

The mock_groq fixture routes LLM responses by system-prompt keywords.
ICD prompts are detected by "ICD" or "coding assistant" in the system
message, so we wire state["icd"] to shape the response per test.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


# ---------------------------------------------------------------------------
# Fixtures — local copies so this file is self-contained within the
# tests/ai/ package (conftest cascade would provide these, but the
# scribe conftest is not a parent of tests/ai/).
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def mock_groq(monkeypatch):
    """ICD-aware LLM stub. Exposes state dict so individual tests can
    override state['icd_response'] (or 'icd') before calling the API."""
    import json
    from typing import Any

    DEFAULT_ICD = {
        "suggestions": [
            {
                "code": "R07.9",
                "description": "Chest pain, unspecified",
                "confidence": 0.85,
                "reasoning": "Documented chest pain.",
            }
        ]
    }

    state: dict[str, Any] = {
        "icd": DEFAULT_ICD,
    }

    async def fake_chat(
        messages,
        *,
        model=None,
        temperature=0.2,
        max_tokens=600,
        json_mode=False,
    ) -> str:
        system = (messages[0].get("content") or "") if messages else ""
        if "ICD" in system or "coding assistant" in system.lower():
            return json.dumps(state["icd"])
        # Fallback — should not happen for these tests
        return json.dumps(state["icd"])

    monkeypatch.setattr("app.ai.llm.llm_client.chat", fake_chat)
    yield state


@pytest_asyncio.fixture
async def client(db_session):
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
async def seeded_icd(db_session):
    """Seed a small subset of icd_catalog for validation tests."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    from app.models.icd_catalog import IcdCatalog

    seeds = [
        {"code": "R07.9", "short_description": "Chest pain, unspecified", "chapter": "Symptoms"},
        {"code": "I10", "short_description": "Essential (primary) hypertension", "chapter": "Circulatory"},
    ]
    for s in seeds:
        await db_session.execute(
            pg_insert(IcdCatalog)
            .values(**s)
            .on_conflict_do_nothing(index_elements=["code"])
        )
    await db_session.flush()
    return seeds


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_icd_suggest_returns_validated_codes(
    client, auth_headers, seeded_icd, mock_groq
):
    """R07.9 is in the catalog → is_validated=True; ZZZ.99 is not → False."""
    mock_groq["icd"] = {
        "suggestions": [
            {
                "code": "R07.9",
                "description": "chest pain",
                "confidence": 0.85,
                "reasoning": "x",
            },
            {
                "code": "ZZZ.99",
                "description": "bogus",
                "confidence": 0.3,
                "reasoning": "y",
            },
        ]
    }

    resp = await client.post(
        "/api/v1/ai/icd-suggest",
        json={"text": "Assessment: chest pain. Plan: ECG, rest."},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "suggestions" in body
    assert len(body["suggestions"]) == 2

    by_code = {s["code"]: s for s in body["suggestions"]}
    assert by_code["R07.9"]["is_validated"] is True
    assert by_code["ZZZ.99"]["is_validated"] is False
    assert "model" in body
    assert "generated_at" in body


@pytest.mark.asyncio
async def test_icd_suggest_handles_empty_llm_response(
    client, auth_headers, seeded_icd, mock_groq
):
    """When the LLM returns an empty suggestions list, 0 items come back."""
    mock_groq["icd"] = {"suggestions": []}

    resp = await client.post(
        "/api/v1/ai/icd-suggest",
        json={"text": "Assessment: normal visit. Plan: no changes."},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["suggestions"] == []


@pytest.mark.asyncio
async def test_icd_suggest_400_on_empty_text(client, auth_headers):
    """Sending text='' must yield 422 (Pydantic min_length=1 validation)."""
    resp = await client.post(
        "/api/v1/ai/icd-suggest",
        json={"text": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 422
