from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.document import Document


# pgvector column is opt-in: we use a JSONB fallback when pgvector is unavailable.
# In production with pgvector installed, swap to Vector(1536).
try:
    from pgvector.sqlalchemy import Vector  # type: ignore

    _embedding_column = lambda: mapped_column(Vector(1536), nullable=True)  # noqa: E731
except ImportError:  # pragma: no cover - graceful fallback for environments without pgvector
    _embedding_column = lambda: mapped_column(JSONB, nullable=True)  # noqa: E731


class DocumentChunk(Base, UUIDMixin):
    __tablename__ = "document_chunks"

    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = _embedding_column()
    chunk_metadata: Mapped[dict | None] = mapped_column(JSONB)

    document: Mapped[Document] = relationship(back_populates="chunks")
