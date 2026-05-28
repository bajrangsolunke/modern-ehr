"""Pulls the document bytes, extracts text via pypdf for PDFs (or
decodes as text for already-text MIME types), and runs the LLM
extractor. Returns the structured batch without persisting — the
endpoint persists in a separate call after the provider reviews."""
from __future__ import annotations

from io import BytesIO
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.lab_extractor import ExtractedLabBatch, extract_labs_from_text
from app.core.logging import get_logger
from app.models.document import Document

log = get_logger(__name__)


class LabExtractionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def extract_from_document(
        self, document_id: UUID
    ) -> tuple[Document, ExtractedLabBatch]:
        doc = await self.db.get(Document, document_id)
        if doc is None:
            raise HTTPException(404, "Document not found")
        if doc.content is None:
            raise HTTPException(
                422,
                "Document has no stored content — re-upload to enable extraction.",
            )

        text = self._content_to_text(doc.content, doc.mime_type or "")
        if not text:
            raise HTTPException(
                422,
                "Couldn't extract text from this document. Supported: PDF, plain text.",
            )

        batch = await extract_labs_from_text(text)
        return doc, batch

    @staticmethod
    def _content_to_text(content: bytes, mime: str) -> str:
        """Best-effort text extraction. PDF via pypdf. Plain text by
        decoding. Image MIMEs are not supported in this prototype —
        return empty so the caller raises a friendly 422."""
        if mime.startswith("application/pdf") or content[:4] == b"%PDF":
            try:
                from pypdf import PdfReader

                reader = PdfReader(BytesIO(content))
                pages = []
                for page in reader.pages:
                    try:
                        t = page.extract_text() or ""
                    except Exception:
                        t = ""
                    if t:
                        pages.append(t)
                return "\n\n".join(pages).strip()
            except Exception as exc:
                log.warning("pdf_text_extract_failed", error=str(exc))
                return ""
        if mime.startswith("text/"):
            try:
                return content.decode("utf-8", errors="ignore").strip()
            except Exception:
                return ""
        return ""
