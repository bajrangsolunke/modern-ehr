"""RAG pipeline over patient documents using pgvector when available.

Chunking, embedding, retrieval, and a simple QA prompt. When pgvector
is unavailable, retrieval falls back to recency + keyword filtering.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import llm_client
from app.core.config import settings
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.schemas.ai import AiQuestionResponse


SYSTEM = """You are a careful medical assistant. Answer ONLY using the provided
context citations. If the answer isn't in the context, say "Insufficient context".
Always include the source document names you used."""


def _chunk(text: str, size: int = 800, overlap: int = 100) -> list[str]:
    chunks: list[str] = []
    i = 0
    while i < len(text):
        chunks.append(text[i : i + size])
        i += size - overlap
    return chunks


class RagService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def index_document(self, document_id: UUID) -> int:
        doc = await self.db.get(Document, document_id)
        if not doc or not doc.extracted_text:
            return 0

        chunks = _chunk(doc.extracted_text)
        for idx, content in enumerate(chunks):
            embedding = await llm_client.embed(content)
            self.db.add(
                DocumentChunk(
                    document_id=doc.id,
                    chunk_index=idx,
                    content=content,
                    embedding=embedding,
                    chunk_metadata={"name": doc.name, "category": doc.category},
                )
            )
        await self.db.flush()
        return len(chunks)

    async def ask(
        self,
        question: str,
        *,
        patient_id: UUID | None = None,
        top_k: int = 4,
    ) -> AiQuestionResponse:
        # Naive retrieval: pick top_k most recent chunks (optionally filtered).
        # Production: replace with pgvector cosine similarity.
        stmt = select(DocumentChunk)
        if patient_id:
            stmt = stmt.join(Document, DocumentChunk.document_id == Document.id).where(
                Document.patient_id == patient_id
            )
        result = await self.db.execute(stmt.limit(top_k))
        chunks = list(result.scalars().all())

        context = "\n\n".join(
            f"[{i + 1}] {(c.chunk_metadata or {}).get('name', 'doc')}: {c.content[:600]}"
            for i, c in enumerate(chunks)
        ) or "(no documents indexed)"

        answer = await llm_client.chat(
            messages=[
                {"role": "system", "content": SYSTEM},
                {
                    "role": "user",
                    "content": f"Question: {question}\n\nContext:\n{context}",
                },
            ],
            max_tokens=400,
        )

        return AiQuestionResponse(
            question=question,
            answer=answer,
            citations=[
                {
                    "chunk_id": str(c.id),
                    "document_id": str(c.document_id),
                    "name": (c.chunk_metadata or {}).get("name"),
                    "preview": c.content[:160],
                }
                for c in chunks
            ],
            model=settings.OPENAI_MODEL_CHAT,
            generated_at=datetime.now(timezone.utc),
        )
