"""Test fixtures for user invite/setup tests."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt

from app.core.config import settings
from app.models.user import User, UserRole


@pytest_asyncio.fixture()
async def admin_user(db_session):
    """An admin-role user for testing admin-only endpoints."""
    u = User(
        email=f"admin-{uuid.uuid4()}@test.example",
        full_name="Test Admin",
        hashed_password="$2b$12$test",  # dummy bcrypt
        role=UserRole.admin,
        is_active=True,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture()
async def invited_user(db_session):
    """A user record with no password (awaiting invite/setup)."""
    u = User(
        email=f"invited-{uuid.uuid4()}@test.example",
        full_name="Invited Provider",
        hashed_password=None,
        role=UserRole.provider,
        is_active=True,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture()
async def client(db_session):
    """HTTP test client with DbSession overridden to use the test session."""
    from app.db.session import get_db
    from app.main import app

    async def _override():
        yield db_session

    app.dependency_overrides[get_db] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def admin_headers(admin_user):
    """Bearer token for admin_user."""
    payload = {
        "sub": str(admin_user.id),
        "type": "access",
        "token_type": "user",
        "role": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return {"Authorization": f"Bearer {token}"}
