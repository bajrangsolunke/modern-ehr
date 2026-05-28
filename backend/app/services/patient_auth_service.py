"""
Patient portal auth — invite issuance, setup, login, refresh, password
reset. Token storage is hashed (SHA-256) on disk; only the un-hashed
value travels in the URL.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.patient import Patient
from app.schemas.patient_auth import TokensOut

# Setup tokens (provider invite) get 24h; password resets get 1h.
SETUP_TOKEN_TTL = timedelta(hours=24)
RESET_TOKEN_TTL = timedelta(hours=1)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _make_tokens(patient_id: UUID) -> TokensOut:
    access = create_access_token(str(patient_id), token_type="patient")
    refresh = create_refresh_token(str(patient_id), token_type="patient")
    return TokensOut(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def _mask_email(email: str) -> str:
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        return f"{local[0]}*@{domain}"
    return f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}@{domain}"


class PatientAuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ----------------------------------------------- invite + setup

    async def issue_invite(self, patient_id: UUID) -> tuple[str, datetime]:
        """Provider-side: generate a one-time invite URL + expiry."""
        patient = await self.db.get(Patient, patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail="Patient not found")
        if not patient.email:
            raise HTTPException(
                status_code=400,
                detail="Patient has no email on file.",
            )
        raw = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + SETUP_TOKEN_TTL
        patient.password_reset_token = _hash_token(raw)
        patient.password_reset_expires = expires
        await self.db.flush()
        url = f"{settings.PATIENT_PORTAL_URL}/setup?token={raw}"
        return url, expires

    async def verify_setup_token(self, raw: str) -> tuple[str, str]:
        """Returns (first_name, masked_email) for the setup page."""
        patient = await self._lookup_by_reset_token(raw)
        return patient.first_name, _mask_email(patient.email or "")

    async def setup(self, *, token: str, password: str) -> TokensOut:
        patient = await self._lookup_by_reset_token(token)
        patient.hashed_password = hash_password(password)
        patient.portal_active = True
        patient.email_verified_at = datetime.now(timezone.utc)
        patient.password_reset_token = None
        patient.password_reset_expires = None
        await self.db.flush()
        return _make_tokens(patient.id)

    # ----------------------------------------------- login + refresh

    async def login(self, *, email: str, password: str) -> TokensOut:
        patient = (
            await self.db.execute(
                select(Patient).where(Patient.email == email)
            )
        ).scalar_one_or_none()
        if (
            patient is None
            or not patient.portal_active
            or not patient.hashed_password
            or not verify_password(password, patient.hashed_password)
        ):
            raise HTTPException(
                status_code=401, detail="Invalid credentials"
            )
        return _make_tokens(patient.id)

    async def refresh(self, *, refresh_token: str) -> TokensOut:
        try:
            payload = decode_token(refresh_token)
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid token")
        if (
            payload.get("type") != "refresh"
            or payload.get("token_type") != "patient"
        ):
            raise HTTPException(status_code=401, detail="Invalid token")
        patient = await self.db.get(Patient, UUID(payload["sub"]))
        if patient is None or not patient.portal_active:
            raise HTTPException(
                status_code=401, detail="Inactive portal account"
            )
        return _make_tokens(patient.id)

    # ----------------------------------------------- password reset

    async def request_reset(self, *, email: str) -> None:
        """Always returns silently — no account enumeration."""
        patient = (
            await self.db.execute(
                select(Patient).where(Patient.email == email)
            )
        ).scalar_one_or_none()
        if patient is None or not patient.portal_active:
            return
        raw = secrets.token_urlsafe(32)
        patient.password_reset_token = _hash_token(raw)
        patient.password_reset_expires = (
            datetime.now(timezone.utc) + RESET_TOKEN_TTL
        )
        await self.db.flush()
        # NOTE: real email delivery is a follow-up. For now the URL
        # ends up in the audit log via the endpoint layer.

    async def reset(self, *, token: str, password: str) -> TokensOut:
        patient = await self._lookup_by_reset_token(token)
        patient.hashed_password = hash_password(password)
        patient.password_reset_token = None
        patient.password_reset_expires = None
        await self.db.flush()
        return _make_tokens(patient.id)

    # ----------------------------------------------- helpers

    async def _lookup_by_reset_token(self, raw: str) -> Patient:
        hashed = _hash_token(raw)
        patient = (
            await self.db.execute(
                select(Patient).where(Patient.password_reset_token == hashed)
            )
        ).scalar_one_or_none()
        if patient is None:
            raise HTTPException(
                status_code=400, detail="Token expired or already used"
            )
        expires = patient.password_reset_expires
        if expires is None or expires < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=400, detail="Token expired or already used"
            )
        return patient
