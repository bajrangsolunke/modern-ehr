"""
Communication endpoints (US-COMM-1..5) — REST surface for the messages
module. Real-time deltas flow through the existing /ws channel (each
write fans out via MessagesService._broadcast_message).
"""
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.ai.suggest_reply import SuggestReplyService
from app.api.deps import CurrentUser, DbSession
from app.schemas.conversation import (
    Audience,
    ConversationDetail,
    ConversationOut,
    CreateClinicianConversationIn,
    CreatePatientConversationIn,
    MarkReadIn,
    MessageOut,
    SendMessageIn,
)
from app.services.audit_service import AuditService
from app.services.messages_service import MessagesService


class SuggestReplyOut(BaseModel):
    suggestion: str

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    db: DbSession,
    current: CurrentUser,
    audience: Audience | None = None,
    q: str | None = Query(None, description="Search last-message snippet or title"),
) -> list[ConversationOut]:
    return await MessagesService(db).list_conversations(
        viewer_id=current.id, audience=audience, q=q
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: UUID,
    db: DbSession,
    current: CurrentUser,
) -> ConversationDetail:
    svc = MessagesService(db)
    conv = await svc.get_conversation(conversation_id, viewer_id=current.id)
    projected = await svc._project(conv, viewer_id=current.id)
    messages = [await svc._project_message(m) for m in conv.messages]
    return ConversationDetail(**projected.model_dump(), messages=messages)


@router.post(
    "/conversations/patient",
    response_model=ConversationDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_patient_conversation(
    request: Request,
    payload: CreatePatientConversationIn,
    db: DbSession,
    current: CurrentUser,
) -> ConversationDetail:
    svc = MessagesService(db)
    conv, msg = await svc.create_patient_conversation(
        viewer_id=current.id,
        patient_id=payload.patient_id,
        body=payload.body,
        urgent=payload.urgent,
    )
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="message.send",
        resource_type="conversation",
        resource_id=str(conv.id),
        payload={"patient_id": str(payload.patient_id), "urgent": payload.urgent},
    )
    projected = await svc._project(conv, viewer_id=current.id)
    msg_out = await svc._project_message(msg)
    return ConversationDetail(**projected.model_dump(), messages=[msg_out])


@router.post(
    "/conversations/clinician",
    response_model=ConversationDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_clinician_conversation(
    request: Request,
    payload: CreateClinicianConversationIn,
    db: DbSession,
    current: CurrentUser,
) -> ConversationDetail:
    svc = MessagesService(db)
    conv, msg = await svc.create_clinician_conversation(
        viewer_id=current.id,
        user_ids=payload.user_ids,
        body=payload.body,
        urgent=payload.urgent,
    )
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="message.send",
        resource_type="conversation",
        resource_id=str(conv.id),
        payload={
            "user_ids": [str(u) for u in payload.user_ids],
            "urgent": payload.urgent,
        },
    )
    projected = await svc._project(conv, viewer_id=current.id)
    msg_out = await svc._project_message(msg)
    return ConversationDetail(**projected.model_dump(), messages=[msg_out])


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: UUID,
    request: Request,
    payload: SendMessageIn,
    db: DbSession,
    current: CurrentUser,
) -> MessageOut:
    svc = MessagesService(db)
    msg = await svc.append_message(
        conversation_id,
        viewer_id=current.id,
        body=payload.body,
        urgent=payload.urgent,
        document_ids=payload.document_ids,
    )
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="message.send",
        resource_type="message",
        resource_id=str(msg.id),
        payload={
            "conversation_id": str(conversation_id),
            "urgent": payload.urgent,
            "document_ids": [str(d) for d in payload.document_ids],
        },
    )
    return await svc._project_message(msg)


@router.post(
    "/conversations/{conversation_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def mark_read(
    conversation_id: UUID,
    payload: MarkReadIn,
    db: DbSession,
    current: CurrentUser,
) -> None:
    await MessagesService(db).mark_read(
        conversation_id, viewer_id=current.id, ts=payload.last_read_at
    )


@router.post(
    "/conversations/{conversation_id}/typing",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def ping_typing(
    conversation_id: UUID,
    db: DbSession,
    current: CurrentUser,
) -> None:
    """Throwaway endpoint — broadcasts a transient "typing" event to
    other participants over the existing WS channel. No DB writes."""
    await MessagesService(db).ping_typing(conversation_id, viewer_id=current.id)


@router.post(
    "/conversations/{conversation_id}/suggest-reply",
    response_model=SuggestReplyOut,
)
async def suggest_reply(
    conversation_id: UUID,
    db: DbSession,
    current: CurrentUser,
) -> SuggestReplyOut:
    """LLM-drafted reply using the thread's recent messages + (for
    patient threads) a slim chart context. Hits the stub fallback when
    OPENAI_API_KEY isn't configured so the button is always functional."""
    svc = MessagesService(db)
    conv = await svc.get_conversation(conversation_id, viewer_id=current.id)
    suggestion = await SuggestReplyService(db).suggest(conv)
    return SuggestReplyOut(suggestion=suggestion)


# Silence unused import warning in some IDEs; HTTPException is re-exported
# above for use by FastAPI's exception handling chain.
_ = HTTPException
