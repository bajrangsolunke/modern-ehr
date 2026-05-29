from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ChargeCreate(BaseModel):
    patient_id: UUID
    service_catalog_id: UUID | None = None
    encounter_id: UUID | None = None
    appointment_id: UUID | None = None
    quantity: int = Field(default=1, ge=1)
    discount_cents: int = Field(default=0, ge=0)

    # Free-form overrides — required as a trio when service_catalog_id is None.
    description: str | None = Field(default=None, max_length=255)
    code: str | None = Field(default=None, max_length=32)
    unit_price_cents: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _require_catalog_or_freeform(self) -> "ChargeCreate":
        if self.service_catalog_id is None and not (
            self.description and self.code and self.unit_price_cents is not None
        ):
            raise ValueError(
                "Provide service_catalog_id, OR description + code + unit_price_cents."
            )
        return self


class ChargeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    encounter_id: UUID | None
    appointment_id: UUID | None
    service_catalog_id: UUID | None
    description: str
    code: str
    quantity: int
    unit_price_cents: int
    discount_cents: int
    tax_cents: int
    total_cents: int
    invoice_id: UUID | None
    voided_at: datetime | None
    created_at: datetime


class ChargeVoidIn(BaseModel):
    reason: str = Field(min_length=1, max_length=255)
