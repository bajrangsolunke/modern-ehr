from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.ai.lab_extractor import ExtractedLab, ExtractedLabBatch  # noqa: F401 — re-export


class LabCreate(BaseModel):
    patient_id: UUID
    name: str
    value: str
    unit: str | None = None
    loinc: str | None = None
    reference_range: str | None = None
    flag: str | None = None


class LabOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    name: str
    value: str
    unit: str | None
    loinc: str | None
    reference_range: str | None
    flag: str | None
    collected_at: datetime
    source_document_id: UUID | None = None
    source_document_name: str | None = None


class LabExtractionPreviewOut(BaseModel):
    document_id: UUID
    document_name: str
    patient_id: UUID
    model: str
    results: list[ExtractedLab]


class LabBatchCreate(BaseModel):
    patient_id: UUID
    source_document_id: UUID | None = None
    results: list[ExtractedLab]
