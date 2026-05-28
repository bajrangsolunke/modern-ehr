"""Aggregator service for the patient-chart AI panel.

Returns summary + risk_score (each cache-aware) + a count of
unresolved AI-source alerts. One round-trip from the frontend; both
LLM calls fan out in parallel inside `get()`."""
from __future__ import annotations

import asyncio
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.risk import RiskService
from app.ai.summary import SummaryService
from app.models.alert import AlertSource, PatientAlert
from app.schemas.ai import AiChartContextResponse


class ChartContextService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(
        self, patient_id: UUID, *, force: bool = False
    ) -> AiChartContextResponse:
        summary_task = SummaryService(self.db).for_patient(patient_id, force=force)
        risk_task = RiskService(self.db).score(patient_id, force=force)
        ai_alerts_count_task = self._count_ai_alerts(patient_id)

        summary, risk, ai_alerts_count = await asyncio.gather(
            summary_task, risk_task, ai_alerts_count_task
        )

        return AiChartContextResponse(
            summary=summary,
            risk=risk,
            ai_alerts_count=ai_alerts_count,
        )

    async def _count_ai_alerts(self, patient_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count(PatientAlert.id)).where(
                PatientAlert.patient_id == patient_id,
                PatientAlert.source == AlertSource.ai,
                PatientAlert.resolved.is_(False),
            )
        )
        return int(result.scalar_one())
