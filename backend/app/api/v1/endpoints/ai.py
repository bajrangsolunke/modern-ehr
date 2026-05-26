from fastapi import APIRouter

from app.ai.rag import RagService
from app.ai.risk import RiskService
from app.ai.scribe import ScribeService
from app.ai.summary import SummaryService
from app.api.deps import CurrentUser, DbSession
from app.schemas.ai import (
    AiQuestionRequest,
    AiQuestionResponse,
    AiRiskScoreResponse,
    AiSummaryRequest,
    AiSummaryResponse,
)
from pydantic import BaseModel

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/summary", response_model=AiSummaryResponse)
async def patient_summary(
    payload: AiSummaryRequest, db: DbSession, current: CurrentUser
) -> AiSummaryResponse:
    return await SummaryService(db).for_patient(payload.patient_id, payload.style)


@router.get("/risk/{patient_id}", response_model=AiRiskScoreResponse)
async def patient_risk(
    patient_id: str, db: DbSession, current: CurrentUser
) -> AiRiskScoreResponse:
    from uuid import UUID

    return await RiskService(db).score(UUID(patient_id))


@router.post("/ask", response_model=AiQuestionResponse)
async def ask(
    payload: AiQuestionRequest, db: DbSession, current: CurrentUser
) -> AiQuestionResponse:
    return await RagService(db).ask(
        payload.question, patient_id=payload.patient_id, top_k=payload.top_k
    )


class ScribeRequest(BaseModel):
    transcript: str


@router.post("/scribe")
async def scribe(payload: ScribeRequest, current: CurrentUser) -> dict:
    return await ScribeService().transcript_to_soap(payload.transcript)
