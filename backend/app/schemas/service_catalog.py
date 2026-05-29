from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ServiceCatalogBase(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(default="visit", max_length=32)
    price_cents: int = Field(ge=0)
    tax_rate_bp: int = Field(default=0, ge=0, le=10000)
    taxable: bool = False


class ServiceCatalogCreate(ServiceCatalogBase):
    pass


class ServiceCatalogUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, max_length=32)
    price_cents: int | None = Field(default=None, ge=0)
    tax_rate_bp: int | None = Field(default=None, ge=0, le=10000)
    taxable: bool | None = None


class ServiceCatalogOut(ServiceCatalogBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
