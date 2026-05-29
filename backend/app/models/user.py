from __future__ import annotations

import enum
from datetime import date, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    LargeBinary,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.appointment import Appointment
    from app.models.audit_log import AuditLog
    from app.models.provider_education import ProviderEducation
    from app.models.provider_license import ProviderLicense
    from app.models.soap_note import SoapNote


class UserRole(str, enum.Enum):
    # Simplified three-role model.
    # - provider: clinicians (write clinical records)
    # - staff: schedulers / coordinators (manage appointments, read patients)
    # - admin: full access, including user management
    provider = "provider"
    staff = "staff"
    admin = "admin"


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.provider, nullable=False
    )
    specialty: Mapped[str | None] = mapped_column(String(255))
    # Same as patient: either an http(s) URL or an inline data URL.
    avatar_url: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # --- Extended provider profile fields (0028) ---
    credential: Mapped[str | None] = mapped_column(String(64))
    first_name: Mapped[str | None] = mapped_column(String(120))
    middle_name: Mapped[str | None] = mapped_column(String(120))
    last_name: Mapped[str | None] = mapped_column(String(120))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(32))
    npi: Mapped[str | None] = mapped_column(String(20), index=True)
    taxonomy_code: Mapped[str | None] = mapped_column(String(32))
    languages_spoken: Mapped[str | None] = mapped_column(Text)
    ssn_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)

    address_line1: Mapped[str | None] = mapped_column(String(255))
    address_line2: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(120))
    zip_code: Mapped[str | None] = mapped_column(String(20))
    telephone: Mapped[str | None] = mapped_column(String(32))
    mobile: Mapped[str | None] = mapped_column(String(32))
    fax: Mapped[str | None] = mapped_column(String(32))
    time_zone: Mapped[str | None] = mapped_column(String(64))

    federal_tax_id_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)
    tax_id_type: Mapped[str | None] = mapped_column(String(16))
    registration_date: Mapped[date | None] = mapped_column(Date)
    primary_service_location: Mapped[str | None] = mapped_column(String(255))
    supervising_provider_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    is_non_billing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false"), default=False
    )

    # Invite / account-setup flow (mirrors patient portal flow).
    # Set when an admin issues an invite; cleared after setup completes.
    password_reset_token: Mapped[str | None] = mapped_column(
        String(128), nullable=True, index=True, unique=True
    )
    password_reset_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Timestamped when the invited user completes /auth/setup.
    setup_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    appointments: Mapped[list[Appointment]] = relationship(
        back_populates="physician", foreign_keys="Appointment.physician_id"
    )
    notes: Mapped[list[SoapNote]] = relationship(back_populates="author")
    audit_logs: Mapped[list[AuditLog]] = relationship(back_populates="user")

    education: Mapped[list["ProviderEducation"]] = relationship(
        "ProviderEducation",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    licenses: Mapped[list["ProviderLicense"]] = relationship(
        "ProviderLicense",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
