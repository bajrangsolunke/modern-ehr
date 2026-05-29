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
    email_queued: bool = False
    """True when SMTP is configured and the email was dispatched as a
    background task. False means the URL must be shared manually."""


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
    avatar_url: str | None = None

    # Extended demographics
    sex: str | None = None
    blood_group: str | None = None
    gender_identity: str | None = None
    preferred_pronouns: str | None = None

    # Mailing address
    mailing_address_line1: str | None = None
    mailing_address_line2: str | None = None
    mailing_city: str | None = None
    mailing_state: str | None = None
    mailing_postal_code: str | None = None
    mailing_country: str | None = None

    # Physical address
    physical_same_as_mailing: bool = True
    physical_address_line1: str | None = None
    physical_address_line2: str | None = None
    physical_city: str | None = None
    physical_state: str | None = None
    physical_postal_code: str | None = None
    physical_country: str | None = None

    # Emergency contact
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relationship: str | None = None


class PatientSelfUpdate(BaseModel):
    """Patch shape for PATCH /patient-portal/me.

    Every field optional — only present fields are written. MRN is
    intentionally absent (durable identifier) and can only be changed
    by the provider's office.
    """

    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    dob: str | None = None  # ISO YYYY-MM-DD

    # Extended demographics
    blood_group: str | None = Field(default=None, max_length=8)
    gender_identity: str | None = Field(default=None, max_length=32)
    preferred_pronouns: str | None = Field(default=None, max_length=32)

    # Mailing address
    mailing_address_line1: str | None = Field(default=None, max_length=255)
    mailing_address_line2: str | None = Field(default=None, max_length=255)
    mailing_city: str | None = Field(default=None, max_length=120)
    mailing_state: str | None = Field(default=None, max_length=64)
    mailing_postal_code: str | None = Field(default=None, max_length=20)
    mailing_country: str | None = Field(default=None, max_length=64)

    # Physical address
    physical_same_as_mailing: bool | None = None
    physical_address_line1: str | None = Field(default=None, max_length=255)
    physical_address_line2: str | None = Field(default=None, max_length=255)
    physical_city: str | None = Field(default=None, max_length=120)
    physical_state: str | None = Field(default=None, max_length=64)
    physical_postal_code: str | None = Field(default=None, max_length=20)
    physical_country: str | None = Field(default=None, max_length=64)

    # Emergency contact
    emergency_contact_name: str | None = Field(default=None, max_length=255)
    emergency_contact_phone: str | None = Field(default=None, max_length=64)
    emergency_contact_relationship: str | None = Field(default=None, max_length=64)


class PatientNotificationPrefs(BaseModel):
    """Per-channel notification toggles. Defaults follow the recommended
    HIPAA-conservative posture: opt-in for SMS / email, opt-in for the
    visit reminders that improve adherence."""

    appointments: bool = True
    sms: bool = True
    email: bool = True
    labs: bool = True


class PatientHealthcarePrefs(BaseModel):
    """Care preferences. All free-text so we don't force the patient
    to find their pharmacy in a directory."""

    pharmacy: str | None = Field(default=None, max_length=255)
    language: str | None = Field(default=None, max_length=64)
    comm_channel: str | None = Field(default=None, max_length=64)


class PatientPreferences(BaseModel):
    """Combined preferences blob returned by GET /me/preferences."""

    notifications: PatientNotificationPrefs = Field(
        default_factory=PatientNotificationPrefs
    )
    healthcare: PatientHealthcarePrefs = Field(
        default_factory=PatientHealthcarePrefs
    )


class PatientPreferencesUpdate(BaseModel):
    """PUT body — only the keys you want to change. Server merges
    with the current value before saving."""

    notifications: PatientNotificationPrefs | None = None
    healthcare: PatientHealthcarePrefs | None = None


class AIHealthSummaryOut(BaseModel):
    """Returned by GET /me/ai-summary. `confidence` ∈ [0, 100]."""

    summary: str
    bullets: list[str] = Field(default_factory=list)
    confidence: int = 90
    generated_at: datetime


class PatientAvatarIn(BaseModel):
    """Body for POST /patient-portal/me/avatar. Accepts a data URL
    (`data:image/png;base64,…`) so we don't need multipart/form-data
    plumbing for what is effectively a small 2 MB blob. Pass `None`
    to clear the existing avatar."""

    avatar_url: str | None = Field(default=None, max_length=4_000_000)


class PatientPasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
