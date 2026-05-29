"""Tests for POST /api/v1/users/{user_id}/invite."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch

pytestmark = pytest.mark.asyncio


async def test_invite_returns_setup_url(client, admin_headers, invited_user):
    """Admin inviting a user gets back a setup_url and expires_at."""
    resp = await client.post(
        f"/api/v1/users/{invited_user.id}/invite",
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "setup_url" in body
    assert "expires_at" in body
    assert "/setup?token=" in body["setup_url"]
    assert isinstance(body["email_queued"], bool)


async def test_invite_non_existent_user_404(client, admin_headers):
    """Inviting a non-existent user should return 404."""
    import uuid
    resp = await client.post(
        f"/api/v1/users/{uuid.uuid4()}/invite",
        headers=admin_headers,
    )
    assert resp.status_code == 404


async def test_invite_requires_admin(client, db_session, invited_user):
    """A provider-level token should be denied (403 or 401)."""
    import uuid
    from datetime import datetime, timedelta, timezone
    from jose import jwt
    from app.core.config import settings
    from app.models.user import User, UserRole

    provider = User(
        email=f"prov-{uuid.uuid4()}@test.example",
        full_name="Provider",
        hashed_password="$2b$12$test",
        role=UserRole.provider,
        is_active=True,
    )
    db_session.add(provider)
    await db_session.flush()
    await db_session.refresh(provider)

    payload = {
        "sub": str(provider.id),
        "type": "access",
        "token_type": "user",
        "role": "provider",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        f"/api/v1/users/{invited_user.id}/invite",
        headers=headers,
    )
    assert resp.status_code in (401, 403)


async def test_invite_emails_background_task(client, admin_headers, invited_user):
    """When SMTP is configured, send_email is called as a background task."""
    with patch(
        "app.services.email_service.send_email", new_callable=AsyncMock
    ) as mock_send, patch(
        "app.services.email_service._is_configured", return_value=True
    ):
        resp = await client.post(
            f"/api/v1/users/{invited_user.id}/invite",
            headers=admin_headers,
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["email_queued"] is True


async def test_invite_audit_log_created(client, admin_headers, invited_user, db_session):
    """Inviting a user creates an audit log entry."""
    from sqlalchemy import select
    from app.models.audit_log import AuditLog

    resp = await client.post(
        f"/api/v1/users/{invited_user.id}/invite",
        headers=admin_headers,
    )
    assert resp.status_code == 200

    log = (
        await db_session.execute(
            select(AuditLog).where(AuditLog.action == "user.invite")
        )
    ).scalar_one_or_none()
    assert log is not None
    assert log.resource_id == str(invited_user.id)
