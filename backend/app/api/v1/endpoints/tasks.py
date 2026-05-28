"""
Tasks endpoints — US-TASK-1..6
(docs/superpowers/specs/2026-05-27-workflow-user-stories.md).
"""
from uuid import UUID

from fastapi import APIRouter, Query, Request, status

from app.api.deps import CurrentUser, DbSession
from app.models.task import TaskCategory, TaskPriority, TaskStatus
from app.schemas.common import Page
from app.schemas.task import (
    TaskAudienceLiteral,
    TaskCategoryLiteral,
    TaskCreate,
    TaskOut,
    TaskPriorityLiteral,
    TaskScopeLiteral,
    TaskStatusLiteral,
    TaskUpdate,
)
from app.services.audit_service import AuditService
from app.services.task_service import TaskService


router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=Page[TaskOut])
async def list_tasks(
    db: DbSession,
    current: CurrentUser,
    scope: TaskScopeLiteral = "all",
    audience: TaskAudienceLiteral = "all",
    q: str | None = Query(None, description="Search title + description"),
    task_status: TaskStatusLiteral | None = Query(None, alias="status"),
    priority: TaskPriorityLiteral | None = None,
    category: TaskCategoryLiteral | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
) -> Page[TaskOut]:
    items, total, pages = await TaskService(db).list(
        viewer_id=current.id,
        scope=scope,
        audience=audience,
        q=q,
        status=TaskStatus(task_status) if task_status else None,
        priority=TaskPriority(priority) if priority else None,
        category=TaskCategory(category) if category else None,
        page=page,
        page_size=page_size,
    )
    return Page[TaskOut](
        items=items, total=total, page=page, page_size=page_size, pages=pages
    )


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth gate
) -> TaskOut:
    return await TaskService(db).get_projected(task_id)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    request: Request,
    payload: TaskCreate,
    db: DbSession,
    current: CurrentUser,
) -> TaskOut:
    out = await TaskService(db).create(viewer_id=current.id, payload=payload)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="task.create",
        resource_type="task",
        resource_id=str(out.id),
        payload=payload.model_dump(),
    )
    return out


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: UUID,
    request: Request,
    payload: TaskUpdate,
    db: DbSession,
    current: CurrentUser,
) -> TaskOut:
    out = await TaskService(db).update(
        task_id, viewer_id=current.id, payload=payload
    )
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="task.update",
        resource_type="task",
        resource_id=str(task_id),
        payload=payload.model_dump(exclude_unset=True),
    )
    return out


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    await TaskService(db).delete(task_id)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="task.delete",
        resource_type="task",
        resource_id=str(task_id),
    )
