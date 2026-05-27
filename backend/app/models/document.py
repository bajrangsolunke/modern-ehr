from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.document_chunk import DocumentChunk
    from app.models.patient import Patient


class Document(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "documents"

    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="general")
    mime_type: Mapped[str] = mapped_column(String(128), default="application/octet-stream")
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    extracted_text: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    uploaded_by: Mapped[str | None] = mapped_column(String(255))
    # Raw bytes — fine for a single-server demo. A real deploy
    # streams to object storage (S3 / GCS) and keeps only the
    # storage_key + size here.
    content: Mapped[bytes | None] = mapped_column(LargeBinary)

    patient: Mapped[Patient] = relationship(back_populates="documents")
    chunks: Mapped[list[DocumentChunk]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )
