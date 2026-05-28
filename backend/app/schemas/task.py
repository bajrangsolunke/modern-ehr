"""Pydantic schemas for the tasks module."""
from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


TaskCategoryLiteral = Literal[
    "reminders",
    "document",
    "image_order",
    "lab_order",
    "referral",
    "payment",
    "unsigned_encounter",
    "other",
]
TaskPriorityLiteral = Literal["low", "medium", "high"]
TaskStatusLiteral = Literal["new", "in_progress", "completed", "cancelled"]
TaskScopeLiteral = Literal["all", "mine", "assigned"]
TaskAudienceLiteral = Literal["all", "patients", "users"]


class TaskOut(BaseModel):
    """Single task with display-ready fields flattened from joins."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None = None
    category: TaskCategoryLiteral
    priority: TaskPriorityLiteral
    status: TaskStatusLiteral

    created_by_user_id: UUID | None = None
    created_by_name: str | None = None
    assigned_to_user_id: UUID | None = None
    assigned_to_name: str | None = None
    patient_id: UUID | None = None
    patient_name: str | None = None

    due_date: date | None = None
    completed_at: datetime | None = None
    completed_by_user_id: UUID | None = None

    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category: TaskCategoryLiteral = "other"
    priority: TaskPriorityLiteral = "medium"
    assigned_to_user_id: UUID | None = None
    patient_id: UUID | None = None
    due_date: date | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: TaskCategoryLiteral | None = None
    priority: TaskPriorityLiteral | None = None
    status: TaskStatusLiteral | None = None
    assigned_to_user_id: UUID | None = None
    patient_id: UUID | None = None
    due_date: date | None = None
