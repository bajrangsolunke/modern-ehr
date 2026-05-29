"""Tests for POST /api/v1/auth/setup and GET /api/v1/auth/setup-info."""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def test_setup_info_returns_user_details(client, admin_headers, invited_user):
    """GET /auth/setup-info should return full_name, email_masked, role for a valid token."""
    # First issue an invite to get a real token.
    invite_resp = await client.post(
        f"/api/v1/users/{invited_user.id}/invite",
        headers=admin_headers,
    )
    assert invite_resp.status_code == 200
    setup_url = invite_resp.json()["setup_url"]
    token = setup_url.split("?token=")[1]

    resp = await client.get(f"/api/v1/auth/setup-info?token={token}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["full_name"] == invited_user.full_name
    assert "@" in body["email_masked"]  # some masking applied
    assert body["role"] == invited_user.role.value


async def test_setup_info_invalid_token_401(client):
    """Invalid token on GET /auth/setup-info returns 401."""
    resp = await client.get("/api/v1/auth/setup-info?token=invalid-garbage-token")
    assert resp.status_code == 401


async def test_setup_completes_account(client, admin_headers, invited_user, db_session):
    """POST /auth/setup should set password, timestamp setup_completed_at,
    and return valid auth tokens."""
    invite_resp = await client.post(
        f"/api/v1/users/{invited_user.id}/invite",
        headers=admin_headers,
    )
    assert invite_resp.status_code == 200
    setup_url = invite_resp.json()["setup_url"]
    raw_token = setup_url.split("?token=")[1]

    setup_resp = await client.post(
        "/api/v1/auth/setup",
        json={"token": raw_token, "password": "SecurePass99!"},
    )
    assert setup_resp.status_code == 201, setup_resp.text
    body = setup_resp.json()
    assert "access_token" in body
    assert "refresh_token" in body

    # Reload user to verify setup_completed_at is stamped.
    await db_session.refresh(invited_user)
    assert invited_user.setup_completed_at is not None
    assert invited_user.hashed_password is not None
    assert invited_user.password_reset_token is None


async def test_setup_token_single_use(client, admin_headers, invited_user):
    """Using a setup token twice should fail on the second attempt."""
    invite_resp = await client.post(
        f"/api/v1/users/{invited_user.id}/invite",
        headers=admin_headers,
    )
    raw_token = invite_resp.json()["setup_url"].split("?token=")[1]

    # First use — should succeed.
    first = await client.post(
        "/api/v1/auth/setup",
        json={"token": raw_token, "password": "SecurePass99!"},
    )
    assert first.status_code == 201

    # Second use — token cleared, should fail.
    second = await client.post(
        "/api/v1/auth/setup",
        json={"token": raw_token, "password": "AnotherPass99!"},
    )
    assert second.status_code == 401


async def test_setup_password_too_short(client, admin_headers, invited_user):
    """Password shorter than 8 characters should be rejected."""
    invite_resp = await client.post(
        f"/api/v1/users/{invited_user.id}/invite",
        headers=admin_headers,
    )
    raw_token = invite_resp.json()["setup_url"].split("?token=")[1]

    resp = await client.post(
        "/api/v1/auth/setup",
        json={"token": raw_token, "password": "short"},
    )
    assert resp.status_code == 422
