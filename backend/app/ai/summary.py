from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import llm_client
from app.core.config import settings
from app.models.allergy import Allergy
from app.models.condition import Condition
from app.models.lab_result import LabResult
from app.models.medication import Medication
from app.models.patient import Patient
from app.schemas.ai import AiSummaryResponse


SYSTEM_PROMPT = """You are a senior clinical AI assistant for a hospital EHR.
Produce concise, clinically accurate summaries. Output JSON:
{
  "summary": "<2-3 sentence clinical summary>",
  "bullets": ["<5 short clinical bullets>", ...],
  "confidence": 0.0-1.0
}
Avoid speculation. Highlight critical risks first.
"""


class SummaryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def for_patient(self, patient_id: UUID, style: str = "clinical") -> AiSummaryResponse:
        patient = await self.db.get(Patient, patient_id)
        if not patient:
            raise ValueError("Patient not found")

        allergies = (
            await self.db.execute(select(Allergy).where(Allergy.patient_id == patient_id))
        ).scalars().all()
        conditions = (
            await self.db.execute(select(Condition).where(Condition.patient_id == patient_id))
        ).scalars().all()
        meds = (
            await self.db.execute(select(Medication).where(Medication.patient_id == patient_id))
        ).scalars().all()
        labs = (
            await self.db.execute(
                select(LabResult).where(LabResult.patient_id == patient_id).limit(10)
            )
        ).scalars().all()

        ctx = self._format_context(patient, allergies, conditions, meds, labs, style)
        raw = await llm_client.chat(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": ctx},
            ],
            json_mode=True,
            max_tokens=500,
        )
        parsed = self._safe_parse(raw, patient)

        return AiSummaryResponse(
            patient_id=patient_id,
            summary=parsed["summary"],
            bullets=parsed["bullets"],
            confidence=parsed["confidence"],
            model=settings.OPENAI_MODEL_CHAT,
            generated_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def _format_context(
        patient: Patient,
        allergies: list[Allergy],
        conditions: list[Condition],
        meds: list[Medication],
        labs: list[LabResult],
        style: str,
    ) -> str:
        a = ", ".join(a.substance for a in allergies) or "None"
        c = ", ".join(c.name for c in conditions) or "None"
        m = ", ".join(f"{m.name} {m.dose}" for m in meds) or "None"
        l = "; ".join(f"{l.name} {l.value}{l.unit or ''} {l.flag or ''}" for l in labs) or "None"
        return (
            f"Style: {style}\n"
            f"Patient: {patient.first_name} {patient.last_name}, "
            f"{patient.sex}, DOB {patient.dob}\n"
            f"Procedure: {patient.procedure} on {patient.procedure_date}\n"
            f"ASA: {patient.asa or 'N/A'}; ICU needed: {patient.icu_needed}\n"
            f"Allergies: {a}\n"
            f"Conditions: {c}\n"
            f"Medications: {m}\n"
            f"Recent labs: {l}\n"
            "Return JSON only."
        )

    @staticmethod
    def _safe_parse(raw: str, patient: Patient) -> dict:
        import json

        try:
            data = json.loads(raw)
            return {
                "summary": data.get("summary", "").strip()
                or f"Surgical candidate {patient.first_name} {patient.last_name}.",
                "bullets": data.get("bullets") or [],
                "confidence": float(data.get("confidence", 0.7)),
            }
        except Exception:
            return {
                "summary": (
                    f"Patient {patient.first_name} {patient.last_name} scheduled for "
                    f"{patient.procedure or 'evaluation'}. Review allergies, anticoagulation, "
                    "and ICU planning."
                ),
                "bullets": [
                    "Review anticoagulation bridge timing",
                    "Confirm ICU bed availability",
                    "Update consent if procedure plan changes",
                ],
                "confidence": 0.5,
            }
