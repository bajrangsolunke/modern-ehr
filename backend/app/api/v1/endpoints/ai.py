from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

from app.ai.chart_context import ChartContextService
from app.ai.llm import llm_client
from app.ai.prompts.icd import ICD_SYSTEM_PROMPT
from app.ai.rag import RagService
from app.ai.risk import RiskService
from app.ai.scribe import ScribeService
from app.ai.summary import SummaryService
from app.api.deps import CurrentUser, DbSession
from app.schemas.ai import (
    AiChartContextResponse,
    AiIcdSuggestRequest,
    AiIcdSuggestResponse,
    AiIcdSuggestionItem,
    AiIntakeSummaryRequest,
    AiIntakeSummaryResponse,
    AiQuestionRequest,
    AiQuestionResponse,
    AiRiskScoreResponse,
    AiSoapDraftResponse,
    AiSummaryRequest,
    AiSummaryResponse,
)
from app.schemas.scribe import LlmIcdOutput
from app.services.audit_service import AuditService
from app.services.icd_validator import validate_codes

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
    AI alert count. Cache-hit responses are sub-100ms; cache-miss runs
    serially against the shared DB session (see ChartContextService)."""
    pid = UUID(patient_id)
    res = await ChartContextService(db).get(pid, force=force)
    audit = AuditService(db)
    await audit.record_request(
        request,
        user_id=current.id,
        action="ai.chart_context",
        resource_type="patient",
        resource_id=str(pid),
        payload={
            "summary_cached": res.summary.cached,
            "risk_cached": res.risk.cached,
            "ai_alerts_count": res.ai_alerts_count,
        },
    )
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
    payload: AiQuestionRequest,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> AiQuestionResponse:
    res = await RagService(db).ask(
        payload.question, patient_id=payload.patient_id, top_k=payload.top_k
    )
    resource_type = "patient" if payload.patient_id else "general"
    resource_id = str(payload.patient_id) if payload.patient_id else ""
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="ai.ask",
        resource_type=resource_type,
        resource_id=resource_id,
        payload={
            "model": res.model,
            "question_chars": len(payload.question),
            "citation_count": len(res.citations),
        },
    )
    return res


@router.post("/icd-suggest", response_model=AiIcdSuggestResponse)
async def icd_suggest(
    payload: AiIcdSuggestRequest,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> AiIcdSuggestResponse:
    """Suggest ICD-10-CM codes for a free-form SOAP note or clinical text.
    Suggestions are ephemeral — the FE may persist them onto the note later."""
    # 1. Call LLM with ICD system prompt
    messages = [
        {"role": "system", "content": ICD_SYSTEM_PROMPT},
        {"role": "user", "content": payload.text},
    ]
    raw = await llm_client.chat(messages, json_mode=True, max_tokens=600)

    # 2. Safe-parse via LlmIcdOutput
    try:
        parsed = LlmIcdOutput.model_validate_json(raw)
    except Exception:
        parsed = LlmIcdOutput()

    # 3. Validate codes against the catalog
    validated = await validate_codes(db, parsed.suggestions)

    # 4. Audit log
    if payload.patient_id is not None:
        resource_type = "patient"
        resource_id = str(payload.patient_id)
    elif payload.note_id is not None:
        resource_type = "soap_note"
        resource_id = str(payload.note_id)
    else:
        resource_type = "text"
        resource_id = ""

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="ai.icd.suggest",
        resource_type=resource_type,
        resource_id=resource_id,
        payload={
            "model": llm_client.chat_model,
            "text_chars": len(payload.text),
            "suggestion_count": len(validated),
        },
    )

    # 5. Return response
    return AiIcdSuggestResponse(
        suggestions=[
            AiIcdSuggestionItem(
                code=v.code,
                description=v.description,
                confidence=v.confidence,
                reasoning=v.reasoning,
                is_validated=v.is_validated,
            )
            for v in validated
        ],
        model=llm_client.chat_model,
        generated_at=datetime.now(timezone.utc),
    )


class ScribeRequest(BaseModel):
    transcript: str
    patient_id: UUID | None = None


@router.post("/scribe")
async def scribe(
    payload: ScribeRequest,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> dict:
    """Turn a clinical-encounter transcript into a SOAP draft. The
    transcript can come from dictation, an ambient recorder, or pasted
    notes. The provider edits before saving — the draft is a starting
    point, not a final note."""
    res = await ScribeService().transcript_to_soap(payload.transcript)
    if payload.patient_id is not None:
        await AuditService(db).record_request(
            request,
            user_id=current.id,
            action="ai.scribe",
            resource_type="patient",
            resource_id=str(payload.patient_id),
            payload={"model": llm_client.chat_model, "transcript_chars": len(payload.transcript)},
        )
    return res


@router.post(
    "/intake-summary/{form_id}",
    response_model=AiIntakeSummaryResponse,
)
async def intake_summary(
    form_id: UUID,
    payload: AiIntakeSummaryRequest,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> AiIntakeSummaryResponse:
    res = await SummaryService(db).summarize_intake_form(form_id, payload.style)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="ai.intake_summary",
        resource_type="form_request",
        resource_id=str(form_id),
        payload={"model": res.model, "style": payload.style},
    )
    return res


@router.post(
    "/soap-from-intake/{patient_id}",
    response_model=AiSoapDraftResponse,
)
async def soap_from_intake(
    patient_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> AiSoapDraftResponse:
    """Generate a SOAP-note draft from this patient's most recent
    submitted intake form. The frontend's SoapNoteDrawer 'Fill from
    intake' button hits this endpoint. The provider then edits before
    saving — the draft is a starting point, not a final note."""
    res = await SummaryService(db).intake_to_soap_for_patient(patient_id)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="ai.soap_from_intake",
        resource_type="patient",
        resource_id=str(patient_id),
        payload={"model": res.model, "form_id": str(res.form_id)},
    )
    return res


@router.get("/provider")
async def provider_info(current: CurrentUser) -> dict:  # noqa: ARG001
    return {
        "provider": llm_client.provider,
        "chat_model": llm_client.chat_model,
        "enabled": llm_client.enabled,
    }
