"""Service-layer tests for the patient auth flow. Use an in-process
async session against the dev DB — no separate test DB setup yet.
Tests roll back so the DB stays clean."""
import uuid
from datetime import datetime

import pytest

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.patient import Patient, PatientStatus, RiskLevel
from app.services.patient_auth_service import PatientAuthService


async def _make_patient(db, *, email: str, portal_active: bool = False) -> Patient:
    p = Patient(
        mrn=f"TEST-{uuid.uuid4().hex[:8]}",
        first_name="Test",
        last_name="Patient",
        sex="F",
        dob=datetime(1990, 1, 1).date(),
        email=email,
        status=PatientStatus.scheduled,
        risk=RiskLevel.low,
        portal_active=portal_active,
    )
    db.add(p)
    await db.flush()
    return p


@pytest.mark.asyncio
async def test_issue_invite_returns_url_and_stores_hashed_token():
    async with AsyncSessionLocal() as db:
        p = await _make_patient(db, email=f"{uuid.uuid4().hex}@test.local")
        url, expires = await PatientAuthService(db).issue_invite(p.id)
        assert "/setup?token=" in url
        assert p.password_reset_token is not None
        raw_token = url.rsplit("=", 1)[-1]
        assert p.password_reset_token != raw_token, (
            "stored token must be hashed, not raw"
        )
        await db.rollback()


@pytest.mark.asyncio
async def test_setup_consumes_token_and_activates_account():
    async with AsyncSessionLocal() as db:
        p = await _make_patient(db, email=f"{uuid.uuid4().hex}@test.local")
        url, _ = await PatientAuthService(db).issue_invite(p.id)
        raw_token = url.rsplit("=", 1)[-1]
        await db.flush()

        tokens = await PatientAuthService(db).setup(
            token=raw_token, password="hunter22pw"
        )
        assert tokens.access_token
        assert tokens.refresh_token
        assert p.portal_active is True
        assert p.password_reset_token is None
        await db.rollback()


@pytest.mark.asyncio
async def test_login_rejects_wrong_password():
    async with AsyncSessionLocal() as db:
        from fastapi import HTTPException

        email = f"{uuid.uuid4().hex}@test.local"
        p = await _make_patient(
            db,
            email=email,
            portal_active=True,
        )
        p.hashed_password = hash_password("correct-password")
        await db.flush()

        with pytest.raises(HTTPException) as exc_info:
            await PatientAuthService(db).login(
                email=email, password="wrong"
            )
        assert exc_info.value.status_code == 401
        await db.rollback()
