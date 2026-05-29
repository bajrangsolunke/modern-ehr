from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.appointment import Appointment
    from app.models.audit_log import AuditLog
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
