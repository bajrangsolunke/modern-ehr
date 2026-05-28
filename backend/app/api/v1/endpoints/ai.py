from uuid import UUID

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

from app.ai.chart_context import ChartContextService
from app.ai.llm import llm_client
from app.ai.rag import RagService
from app.ai.risk import RiskService
from app.ai.scribe import ScribeService
from app.ai.summary import SummaryService
from app.api.deps import CurrentUser, DbSession
from app.schemas.ai import (
    AiChartContextResponse,
    AiIntakeSummaryRequest,
    AiIntakeSummaryResponse,
    AiQuestionRequest,
    AiQuestionResponse,
    AiRiskScoreResponse,
    AiSummaryRequest,
    AiSummaryResponse,
)
from app.services.audit_service import AuditService

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/summary", response_model=AiSummaryResponse)
async def patient_summary(
    payload: AiSummaryRequest,
    request: Request,
    db: DbSession,
    current: CurrentUser,
    force: bool = Query(False, description="Bypass cache and recompute"),
) -> AiSummaryResponse:
    res = await SummaryService(db).for_patient(
        payload.patient_id, payload.style, force=force
    )
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="ai.summary",
        resource_type="patient",
        resource_id=str(payload.patient_id),
        payload={"model": res.model, "cached": res.cached},
    )
    return res


@router.get("/risk/{patient_id}", response_model=AiRiskScoreResponse)
async def patient_risk(
    patient_id: str,
    request: Request,
    db: DbSession,
    current: CurrentUser,
    force: bool = Query(False, description="Bypass cache and recompute"),
) -> AiRiskScoreResponse:
    pid = UUID(patient_id)
    res = await RiskService(db).score(pid, force=force)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="ai.risk",
        resource_type="patient",
        resource_id=str(pid),
        payload={"model": res.model, "cached": res.cached},
    )
    return res


@router.get(
    "/chart-context/{patient_id}",
    response_model=AiChartContextResponse,
)
async def chart_context(
    patient_id: str,
    request: Request,
    db: DbSession,
    current: CurrentUser,
    force: bool = Query(False, description="Bypass cache and recompute both"),
) -> AiChartContextResponse:
    """One-shot AI panel data for the patient chart — summary + risk +
    AI alert count. Both LLM calls run in parallel."""
    pid = UUID(patient_id)
    res = await ChartContextService(db).get(pid, force=force)
    audit = AuditService(db)
    await audit.record_request(
        request,
        user_id=current.id,
        action="ai.summary",
        resource_type="patient",
        resource_id=str(pid),
        payload={"model": res.summary.model, "cached": res.summary.cached},
    )
    await audit.record_request(
        request,
        user_id=current.id,
        action="ai.risk",
        resource_type="patient",
        resource_id=str(pid),
        payload={"model": res.risk.model, "cached": res.risk.cached},
    )
    return res


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


@router.post(
    "/intake-summary/{form_id}",
    response_model=AiIntakeSummaryResponse,
)
async def intake_summary(
    form_id: UUID,
    payload: AiIntakeSummaryRequest,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> AiIntakeSummaryResponse:
    return await SummaryService(db).summarize_intake_form(form_id, payload.style)


@router.get("/provider")
async def provider_info(current: CurrentUser) -> dict:  # noqa: ARG001
    return {
        "provider": llm_client.provider,
        "chat_model": llm_client.chat_model,
        "enabled": llm_client.enabled,
    }
