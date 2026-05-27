from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    name: str
    category: str
    mime_type: str
    size_bytes: int
    summary: str | None
    uploaded_by: str | None
    created_at: datetime
    patient_name: str | None = None
    patient_mrn: str | None = None
    has_preview: bool = False

    @model_validator(mode="before")
    @classmethod
    def _flatten(cls, data):
        if isinstance(data, dict):
            return data
        # When constructed from a SQLAlchemy row, surface patient
        # display fields + a preview flag (text/* documents we
        # successfully extracted).
        patient = getattr(data, "patient", None)
        extracted = getattr(data, "extracted_text", None)
        extras: dict = {
            "has_preview": bool(extracted),
        }
        if patient is not None:
            extras["patient_name"] = (
                f"{patient.first_name} {patient.last_name}".strip()
            )
            extras["patient_mrn"] = patient.mrn
        return _DocRow(data, extras)


class _DocRow:
    def __init__(self, row, extras: dict):
        self._row = row
        self._extras = extras

    def __getattr__(self, item):
        if item in self._extras:
            return self._extras[item]
        return getattr(self._row, item)


class DocumentUploadResponse(BaseModel):
    document: DocumentOut
    chunks_indexed: int


class DocumentPreview(BaseModel):
    """Text body returned for preview requests on text/* docs."""

    id: UUID
    name: str
    mime_type: str
    text: str
