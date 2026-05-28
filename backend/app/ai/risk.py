"""Lightweight rule + LLM hybrid risk scoring.

Returns a 0-100 risk score with categorical level and drivers.
Cached in ai_insight using compute_chart_hash so repeated chart opens
don't re-run the (cheap) rule pass + (less-cheap) LLM model call.
"""
from __future__ import annotations

from datetime import date as _date
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.chart_hash import compute_chart_hash
from app.ai.llm import llm_client
from app.models.ai_insight import AiInsight
from app.models.allergy import Allergy
from app.models.condition import Condition
from app.models.lab_result import LabResult
from app.models.medication import Medication
from app.models.patient import Patient
from app.schemas.ai import AiRiskScoreResponse


HIGH_RISK_CONDITIONS = {
    "diabetes",
    "hypertension",
    "chf",
    "copd",
    "ckd",
    "afib",
    "cad",
}
ANTICOAG_KEYWORDS = {"apixaban", "warfarin", "rivaroxaban", "dabigatran"}


class RiskService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def score(
        self, patient_id: UUID, *, force: bool = False
    ) -> AiRiskScoreResponse:
        patient = await self.db.get(Patient, patient_id)
        if not patient:
            raise ValueError("Patient not found")

        conditions = (
            await self.db.execute(select(Condition).where(Condition.patient_id == patient_id))
        ).scalars().all()
        meds = (
            await self.db.execute(select(Medication).where(Medication.patient_id == patient_id))
        ).scalars().all()
        allergies = (
            await self.db.execute(select(Allergy).where(Allergy.patient_id == patient_id))
        ).scalars().all()
        labs = (
            await self.db.execute(
                select(LabResult)
                .where(LabResult.patient_id == patient_id)
                .order_by(LabResult.collected_at.desc())
                .limit(10)
            )
        ).scalars().all()

        chart_hash = compute_chart_hash(
            patient=patient,
            allergies=allergies,
            conditions=conditions,
            medications=meds,
            labs=labs,
        )

        if not force:
            cached_row = (
                await self.db.execute(
                    select(AiInsight)
                    .where(
                        AiInsight.patient_id == patient_id,
                        AiInsight.category == "risk_score",
                        AiInsight.content_hash == chart_hash,
                    )
                    .order_by(AiInsight.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if cached_row is not None:
                actions = cached_row.actions or {}
                return AiRiskScoreResponse(
                    patient_id=patient_id,
                    risk_score=int(actions.get("risk_score", 0)),
                    risk_level=str(actions.get("risk_level", "low")),
                    drivers=list(actions.get("drivers") or []),
                    recommended_actions=list(actions.get("recommended_actions") or []),
                    model=cached_row.model,
                    generated_at=cached_row.created_at,
                    cached=True,
                )

        score = 0
        drivers: list[str] = []

        if patient.asa in {"III", "IV"}:
            score += 30
            drivers.append(f"ASA {patient.asa}")
        if patient.icu_needed:
            score += 15
            drivers.append("ICU required")

        for c in conditions:
            if any(k in (c.name or "").lower() for k in HIGH_RISK_CONDITIONS):
                score += 8
                drivers.append(f"Condition: {c.name}")

        for m in meds:
            if any(k in (m.name or "").lower() for k in ANTICOAG_KEYWORDS):
                score += 10
                drivers.append(f"Anticoagulant: {m.name}")

        if len(allergies) >= 2:
            score += 4
            drivers.append("Multiple allergies")

        if patient.dob:
            age = (_date.today() - patient.dob).days // 365
            if age >= 70:
                score += 12
                drivers.append(f"Age {age}")
            elif age >= 55:
                score += 6
                drivers.append(f"Age {age}")

        score = min(100, score)
        level = self._level(score)
        actions_list = self._actions(level, drivers)
        model_id = f"{llm_client.chat_model}+rules"

        row = AiInsight(
            patient_id=patient_id,
            category="risk_score",
            title=f"Risk score: {patient.first_name} {patient.last_name}",
            summary=f"{level.upper()} risk (score {score})",
            confidence=0.7,
            model=model_id,
            actions={
                "risk_score": score,
                "risk_level": level,
                "drivers": drivers[:6],
                "recommended_actions": actions_list,
            },
            content_hash=chart_hash,
        )
        self.db.add(row)
        await self.db.flush()
        await self.db.refresh(row)

        return AiRiskScoreResponse(
            patient_id=patient_id,
            risk_score=score,
            risk_level=level,
            drivers=drivers[:6],
            recommended_actions=actions_list,
            model=model_id,
            generated_at=row.created_at,
            cached=False,
        )

    @staticmethod
    def _level(score: int) -> str:
        if score >= 70:
            return "critical"
        if score >= 50:
            return "high"
        if score >= 25:
            return "moderate"
        return "low"

    @staticmethod
    def _actions(level: str, drivers: list[str]) -> list[str]:
        base = {
            "low": ["Continue standard pathway"],
            "moderate": ["Increase pre-op vitals frequency", "Review allergy list"],
            "high": [
                "ICU bed pre-allocation",
                "Anesthesia consult 48h pre-op",
                "Coagulation bridging plan",
            ],
            "critical": [
                "Multidisciplinary review required",
                "ICU bed mandatory",
                "Consider postponing if any criterion unmet",
            ],
        }
        actions = list(base.get(level, []))
        if any("Anticoagulant" in d for d in drivers):
            actions.append("Confirm anticoagulation pause window")
        return actions
