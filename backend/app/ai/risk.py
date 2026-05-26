"""Lightweight rule + LLM hybrid risk scoring.

Returns a 0-100 risk score with categorical level and drivers.
A real implementation would use a trained model; this scaffold demonstrates
the contract and the shape of the output the frontend consumes.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.allergy import Allergy
from app.models.condition import Condition
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

    async def score(self, patient_id: UUID) -> AiRiskScoreResponse:
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

        # Age component (very rough)
        from datetime import date as _date

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
        actions = self._actions(level, drivers)

        return AiRiskScoreResponse(
            patient_id=patient_id,
            risk_score=score,
            risk_level=level,
            drivers=drivers[:6],
            recommended_actions=actions,
            model=f"{settings.OPENAI_MODEL_CHAT}+rules",
            generated_at=datetime.now(timezone.utc),
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
