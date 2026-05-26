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


class AiRiskScoreResponse(BaseModel):
    patient_id: UUID
    risk_score: int
    risk_level: str
    drivers: list[str]
    recommended_actions: list[str]
    model: str
    generated_at: datetime


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
