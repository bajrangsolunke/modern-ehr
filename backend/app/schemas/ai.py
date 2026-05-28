from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AiSummaryRequest(BaseModel):
    patient_id: UUID
    style: str = Field("clinical", description="One of: clinical, patient-friendly, brief")


class AiSummaryResponse(BaseModel):
    patient_id: UUID
    summary: str
    bullets: list[str]
    confidence: float
    model: str
    generated_at: datetime
    cached: bool = False


class AiRiskScoreResponse(BaseModel):
    patient_id: UUID
    risk_score: int
    risk_level: str
    drivers: list[str]
    recommended_actions: list[str]
    model: str
    generated_at: datetime
    cached: bool = False


class AiInsightOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID | None
    category: str
    title: str
    summary: str
    confidence: float
    actions: dict | None
    created_at: datetime


class AiQuestionRequest(BaseModel):
    question: str
    patient_id: UUID | None = None
    top_k: int = Field(4, ge=1, le=10)


class AiQuestionResponse(BaseModel):
    question: str
    answer: str
    citations: list[dict]
    model: str
    generated_at: datetime


class AiIntakeSummaryRequest(BaseModel):
    """Optional knobs for the intake-form summarizer. The form_id comes
    from the URL path."""

    style: str = Field(
        "clinical",
        description="One of: clinical (provider-facing), patient-friendly, brief",
    )


class AiIntakeSummaryResponse(BaseModel):
    form_id: UUID
    patient_id: UUID
    summary: str
    """2–3 sentence overview a clinician can read at a glance."""
    bullets: list[str]
    """Short bullet list of clinically-relevant facts."""
    red_flags: list[str]
    """Allergies, anticoag, contraindications, urgent issues to flag up front."""
    follow_ups: list[str]
    """Things the clinician should ask the patient about during the visit."""
    confidence: float
    model: str
    generated_at: datetime


class AiChartContextResponse(BaseModel):
    """One-shot aggregator for the patient-chart AI panel — summary +
    risk + count of unresolved AI alerts."""

    summary: AiSummaryResponse
    risk: AiRiskScoreResponse
    ai_alerts_count: int
