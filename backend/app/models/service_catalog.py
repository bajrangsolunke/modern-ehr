from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDMixin


class ServiceCategory(str, enum.Enum):
    visit = "visit"
    procedure = "procedure"
    lab = "lab"
    supply = "supply"
    membership = "membership"
    other = "other"


class ServiceCatalog(Base, UUIDMixin):
    __tablename__ = "service_catalog"

    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(32), default="visit", nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tax_rate_bp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    taxable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
