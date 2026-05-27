from datetime import time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AvailabilityBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Mon, 6=Sun")
    start_time: time
    end_time: time
    is_active: bool = True
    note: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _ordered(self) -> "AvailabilityBase":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class AvailabilityCreate(AvailabilityBase):
    pass


class AvailabilityUpdate(BaseModel):
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    is_active: bool | None = None
    note: str | None = Field(default=None, max_length=255)


class AvailabilityOut(AvailabilityBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
