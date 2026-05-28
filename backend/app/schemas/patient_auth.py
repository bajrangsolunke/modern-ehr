"""Pydantic schemas for the patient portal auth surface."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PortalInviteOut(BaseModel):
    """Provider-side: response to POST /patients/{id}/portal-invite.
    Carries the un-hashed token + the magic URL for the provider to
    copy. The token is single-use and stored hashed on disk."""

    setup_url: str
    expires_at: datetime


class SetupVerifyIn(BaseModel):
    token: str = Field(min_length=16, max_length=128)


class SetupVerifyOut(BaseModel):
    """What we tell the patient on the setup page so they can confirm
    they're at the right page before typing a password."""

    first_name: str
    masked_email: str


class SetupIn(BaseModel):
    token: str = Field(min_length=16, max_length=128)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshIn(BaseModel):
    refresh_token: str


class RequestResetIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str = Field(min_length=16, max_length=128)
    password: str = Field(min_length=8, max_length=128)


class TokensOut(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    """Seconds until the access token expires."""


class PatientMeOut(BaseModel):
    """Slim profile returned by GET /patient-portal/me."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    mrn: str
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
    dob: str | None = None
