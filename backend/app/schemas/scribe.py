"""Pydantic schemas for the ambient-scribe feature.

Separated into:
  * IO schemas — what the API accepts / returns (snake_case fields to
    match the rest of the backend's JSON payload conventions)
  * Internal LLM schemas — what the LLM returns inside json_mode, used
    by the finalize pipeline for parsing and validation
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


ScribeSessionStatusLiteral = Literal[
    "created", "recording", "processing", "completed", "failed"
]


# ----------------------------- transcripts -----------------------------


class TranscriptChunkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    sequence: int
    text: str
    duration_ms: int | None = None
    created_at: datetime


# -------------------------------- SOAP --------------------------------


class SoapNoteIn(BaseModel):
    """Edit payload for an existing AI-drafted SOAP note. Each field is
    optional — clients PATCH whichever section they touched."""

    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None


class SoapNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    subjective: str
    objective: str
    assessment: str
    plan: str
    created_at: datetime
    edited_at: datetime | None = None


# -------------------------------- ICD ---------------------------------


class IcdSuggestionIn(BaseModel):
    """PATCH payload for an existing suggestion — accept / edit code /
    edit description. The backend re-validates against icd_catalog when
    the code changes."""

    code: str | None = Field(default=None, min_length=1, max_length=16)
    description: str | None = Field(default=None, min_length=1, max_length=512)
    accepted_by_user: bool | None = None


class IcdSuggestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    code: str
    description: str
    confidence: float
    reasoning: str | None = None
    is_validated: bool
    accepted_by_user: bool
    created_at: datetime


# ------------------------------ sessions ------------------------------


class SessionCreate(BaseModel):
    patient_id: UUID
    chief_complaint: str | None = Field(default=None, max_length=512)


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID | None
    patient_id: UUID
    chief_complaint: str | None
    status: ScribeSessionStatusLiteral
    transcript_text: str
    visit_summary: str | None
    error_message: str | None
    started_at: datetime
    completed_at: datetime | None


class SessionFull(SessionOut):
    """SessionOut + the children — what GET /sessions/:id returns."""

    transcripts: list[TranscriptChunkOut] = Field(default_factory=list)
    soap_note: SoapNoteOut | None = None
    icd_suggestions: list[IcdSuggestionOut] = Field(default_factory=list)


class SessionSummaryIn(BaseModel):
    visit_summary: str = Field(min_length=1)


# ---------------------------- chunk upload ----------------------------


class ChunkUploadResponse(BaseModel):
    """Response for POST /sessions/:id/audio-chunk. We return the
    fragment we just transcribed AND the denormalized transcript
    so the client doesn't have to keep state."""

    sequence: int
    text: str
    transcript_so_far: str


# --------------------------- LLM (internal) ---------------------------


class LlmSoapOutput(BaseModel):
    """Strict JSON shape we expect back from the SOAP prompt. The
    finalize pipeline validates the LLM response against this; on
    failure it stores empty strings + flips session.status='failed'."""

    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""


class LlmIcdSuggestion(BaseModel):
    code: str = Field(min_length=1, max_length=16)
    description: str = Field(min_length=1, max_length=512)
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str | None = None


class LlmIcdOutput(BaseModel):
    suggestions: list[LlmIcdSuggestion] = Field(default_factory=list)


class LlmSummaryOutput(BaseModel):
    summary: str = ""
