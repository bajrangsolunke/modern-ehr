from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    name: str
    category: str
    mime_type: str
    size_bytes: int
    summary: str | None
    created_at: datetime


class DocumentUploadResponse(BaseModel):
    document: DocumentOut
    chunks_indexed: int
