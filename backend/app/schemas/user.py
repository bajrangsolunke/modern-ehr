from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models.user import UserRole


# ---------------------------------------------------------------------------
# Invite + setup schemas
# ---------------------------------------------------------------------------


class UserInviteResponse(BaseModel):
    """Admin-side: response to POST /users/{id}/invite."""

    setup_url: str
    expires_at: datetime
    email_queued: bool = False
    """True when SMTP is configured and the email was dispatched as a
    background task. False means the URL must be shared manually."""


class UserSetupRequest(BaseModel):
    """Body for POST /auth/setup (staff account setup)."""

    token: str = Field(min_length=16, max_length=128)
    password: str = Field(min_length=8, max_length=128)


class UserSetupInfoResponse(BaseModel):
    """Lightweight info returned by GET /auth/setup-info so the setup page
    can greet the user without requiring a password."""

    full_name: str
    email_masked: str
    role: str


# ---------------------------------------------------------------------------
# Sub-row schemas: education / work + licenses
# ---------------------------------------------------------------------------


class ProviderEducationIn(BaseModel):
    kind: Literal["education", "work"]
    institution: str = Field(min_length=1, max_length=255)
    title: str | None = Field(default=None, max_length=255)
    field_or_specialty: str | None = Field(default=None, max_length=255)
    start_year: int | None = Field(default=None, ge=1900, le=2100)
    end_year: int | None = Field(default=None, ge=1900, le=2100)
    notes: str | None = None


class ProviderEducationOut(ProviderEducationIn):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime


class ProviderLicenseIn(BaseModel):
    license_type: str = Field(min_length=1, max_length=64)
    license_number: str = Field(min_length=1, max_length=64)
    issuing_state: str | None = Field(default=None, max_length=64)
    issuing_authority: str | None = Field(default=None, max_length=255)
    issued_date: date | None = None
    expires_date: date | None = None
    notes: str | None = None


class ProviderLicenseOut(ProviderLicenseIn):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime


# ---------------------------------------------------------------------------
# User schemas
# ---------------------------------------------------------------------------


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    role: UserRole = UserRole.provider
    specialty: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=2_000_000)

    # Basic
    credential: str | None = Field(default=None, max_length=64)
    first_name: str | None = Field(default=None, max_length=120)
    middle_name: str | None = Field(default=None, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, max_length=32)
    npi: str | None = Field(default=None, max_length=20)
    taxonomy_code: str | None = Field(default=None, max_length=32)
    languages_spoken: str | None = None

    # Contact
    address_line1: str | None = Field(default=None, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    zip_code: str | None = Field(default=None, max_length=20)
    telephone: str | None = Field(default=None, max_length=32)
    mobile: str | None = Field(default=None, max_length=32)
    fax: str | None = Field(default=None, max_length=32)
    time_zone: str | None = Field(default=None, max_length=64)

    # Other
    tax_id_type: str | None = Field(default=None, max_length=16)
    registration_date: date | None = None
    primary_service_location: str | None = Field(default=None, max_length=255)
    supervising_provider_id: UUID | None = None
    is_non_billing: bool = False


class UserCreate(UserBase):
    password: str | None = Field(default=None, min_length=8, max_length=128)
    """Optional — omit to create an invited (password-less) user. The admin
    must then call POST /users/{id}/invite so the user can set their password."""

    ssn: str | None = Field(default=None, max_length=32)
    federal_tax_id: str | None = Field(default=None, max_length=32)
    education: list[ProviderEducationIn] = Field(default_factory=list)
    licenses: list[ProviderLicenseIn] = Field(default_factory=list)


class UserUpdate(BaseModel):
    """
    Patch shape — every field optional. Email is intentionally NOT here
    because it's the durable user identifier and changing it would orphan
    audit trails.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: UserRole | None = None
    specialty: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=2_000_000)
    is_active: bool | None = None
    # Optional; admins can reset a user's password from the users page.
    password: str | None = Field(default=None, min_length=8, max_length=128)

    # Extended profile fields (all optional)
    credential: str | None = Field(default=None, max_length=64)
    first_name: str | None = Field(default=None, max_length=120)
    middle_name: str | None = Field(default=None, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, max_length=32)
    npi: str | None = Field(default=None, max_length=20)
    taxonomy_code: str | None = Field(default=None, max_length=32)
    languages_spoken: str | None = None
    ssn: str | None = Field(default=None, max_length=32)
    address_line1: str | None = Field(default=None, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    zip_code: str | None = Field(default=None, max_length=20)
    telephone: str | None = Field(default=None, max_length=32)
    mobile: str | None = Field(default=None, max_length=32)
    fax: str | None = Field(default=None, max_length=32)
    time_zone: str | None = Field(default=None, max_length=64)
    federal_tax_id: str | None = Field(default=None, max_length=32)
    tax_id_type: str | None = Field(default=None, max_length=16)
    registration_date: date | None = None
    primary_service_location: str | None = Field(default=None, max_length=255)
    supervising_provider_id: UUID | None = None
    is_non_billing: bool | None = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    is_verified: bool
    setup_completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    education: list[ProviderEducationOut] = Field(default_factory=list)
    licenses: list[ProviderLicenseOut] = Field(default_factory=list)
    ssn_last4: str | None = None
    federal_tax_id_last4: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _derive_masked_fields(cls, data):
        if isinstance(data, dict):
            return data
        # SQLAlchemy row — derive masked previews.
        from app.core.crypto import decrypt_field, mask_last4

        extras: dict[str, str | None] = {}
        ssn_enc = getattr(data, "ssn_encrypted", None)
        if ssn_enc:
            try:
                extras["ssn_last4"] = mask_last4(decrypt_field(ssn_enc))
            except Exception:
                extras["ssn_last4"] = "****"
        tax_enc = getattr(data, "federal_tax_id_encrypted", None)
        if tax_enc:
            try:
                extras["federal_tax_id_last4"] = mask_last4(decrypt_field(tax_enc))
            except Exception:
                extras["federal_tax_id_last4"] = "****"
        if not extras:
            return data

        # Return an attribute-proxy so Pydantic still reads other
        # attributes off the SQLAlchemy row.
        class _Proxy:
            def __init__(self, row, ex):
                self._row = row
                self._ex = ex

            def __getattr__(self, item):
                if item in self._ex:
                    return self._ex[item]
                return getattr(self._row, item)

        return _Proxy(data, extras)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SelfUpdate(BaseModel):
    """
    What a non-admin user can change about their own account.
    Email and role are intentionally absent — those route through
    admin user management.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    specialty: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=2_000_000)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


UserCreate.model_rebuild()
UserOut.model_rebuild()
