"""Background tasks for async work: AI generation, document indexing, notifications."""
from __future__ import annotations

import asyncio
from uuid import UUID

from app.core.logging import get_logger
from app.workers.celery_app import celery_app

log = get_logger(__name__)


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="ai.generate_patient_summary")
def generate_patient_summary(patient_id: str) -> dict:
    from app.ai.summary import SummaryService
    from app.db.session import AsyncSessionLocal

    async def _go():
        async with AsyncSessionLocal() as session:
            res = await SummaryService(session).for_patient(UUID(patient_id))
            return res.model_dump(mode="json")

    log.info("task_summary_start", patient_id=patient_id)
    return _run(_go())


@celery_app.task(name="documents.index")
def index_document(document_id: str) -> int:
    from app.ai.rag import RagService
    from app.db.session import AsyncSessionLocal

    async def _go():
        async with AsyncSessionLocal() as session:
            n = await RagService(session).index_document(UUID(document_id))
            await session.commit()
            return n

    log.info("task_index_doc", document_id=document_id)
    return _run(_go())
