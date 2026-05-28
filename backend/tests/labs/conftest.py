"""Test fixtures for lab extraction tests. Mocks llm_client.chat so no
test ever hits the real API. Follows the same pattern as
tests/scribe/conftest.py."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


DEFAULT_LAB_RESULTS = {
    "results": [
        {"name": "HbA1c", "value": "6.5", "unit": "%", "reference_range": "4.0-5.6", "flag": "H"},
        {"name": "Blood Pressure", "value": "142/88", "unit": "mmHg", "reference_range": None, "flag": "H"},
        {"name": "INR", "value": "1.2", "unit": None, "reference_range": "0.8-1.1", "flag": "H"},
    ]
}


@pytest.fixture(autouse=True)
def mock_groq(monkeypatch):
    """Replace llm_client.chat with a canned-response stub.
    Yields a state dict so individual tests can override responses via
    mock_groq['lab_results'] = {...} or mock_groq['raise_on_chat'] = True."""
    state: dict[str, Any] = {
        "lab_results": DEFAULT_LAB_RESULTS,
        "raise_on_chat": False,
    }

    async def fake_chat(
        messages, *, model=None, temperature=0.2, max_tokens=600, json_mode=False
    ) -> str:
        if state["raise_on_chat"]:
            raise RuntimeError("LLM intentionally raised by test")
        return json.dumps(state["lab_results"])

    monkeypatch.setattr("app.ai.llm.llm_client.chat", fake_chat)

    yield state


# ---------------------------------------------------------------------------
# HTTP client + auth helpers — mirror of scribe/conftest.py
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
