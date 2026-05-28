from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IcdCatalog(Base):
    """Local copy of the CMS ICD-10-CM catalog used to validate LLM-
    suggested codes. Seeded from a TSV file via `app.catalog.seed_icd10`.
    `code` is the primary key — there are ~75k valid ICD-10-CM codes;
    this prototype ships with a seed of the most common ~50."""

    __tablename__ = "icd_catalog"

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    short_description: Mapped[str] = mapped_column(String(255), nullable=False)
    long_description: Mapped[str | None] = mapped_column(Text)
    chapter: Mapped[str | None] = mapped_column(String(128))
