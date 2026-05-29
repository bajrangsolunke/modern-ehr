"""Staff (provider / admin) account invite + setup flow.

Mirrors PatientAuthService.issue_invite / setup but targets the users
table. The admin creates a User record (possibly without a password via
POST /users with password=None), then calls issue_invite to get a
one-time setup URL the user can use to set their password.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, hash_password
from app.models.user import User
from app.schemas.common import Token

SETUP_TOKEN_TTL = timedelta(hours=24)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _mask_email(email: str) -> str:
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        return f"{local[0]}*@{domain}"
    return f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}@{domain}"


class UserInviteService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def issue_invite(self, user_id: UUID) -> tuple[str, datetime]:
        """Generate a one-time setup URL and persist its hash on the user.
        Returns (setup_url, expires_at)."""
        user = await self.db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        if not user.email:
            raise HTTPException(
                status_code=400, detail="User has no email on file."
            )
        raw = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + SETUP_TOKEN_TTL
        user.password_reset_token = _hash_token(raw)
        user.password_reset_expires = expires
        await self.db.flush()
        url = f"{settings.PROVIDER_PORTAL_URL}/setup?token={raw}"
        return url, expires

    async def lookup_by_token(self, raw_token: str) -> User:
        """Used by GET /auth/setup-info and POST /auth/setup.
        Raises 401 if token is invalid or expired."""
        hashed = _hash_token(raw_token)
        user = (
            await self.db.execute(
                select(User).where(User.password_reset_token == hashed)
            )
        ).scalar_one_or_none()
        if user is None:
            raise HTTPException(
                status_code=401, detail="Setup link is invalid or has already been used"
            )
        expires = user.password_reset_expires
        if expires is None or expires < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=401, detail="Setup link has expired — ask your admin to resend"
            )
        return user

    async def complete_setup(self, *, token: str, password: str) -> Token:
        """Hash the password, record setup_completed_at, clear the token,
        and return a fresh auth-token pair."""
        user = await self.lookup_by_token(token)
        user.hashed_password = hash_password(password)
        user.setup_completed_at = datetime.now(timezone.utc)
        user.password_reset_token = None
        user.password_reset_expires = None
        await self.db.flush()
        return Token(
            access_token=create_access_token(
                str(user.id), claims={"role": user.role.value}
            ),
            refresh_token=create_refresh_token(str(user.id)),
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def get_setup_info(self, raw_token: str) -> dict:
        """Return display info for the setup page — no PHI beyond the
        recipient's own name and masked email."""
        user = await self.lookup_by_token(raw_token)
        return {
            "full_name": user.full_name,
            "email_masked": _mask_email(user.email),
            "role": user.role.value,
        }
