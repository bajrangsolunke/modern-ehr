"""
TaskService — list / get / create / update / complete on the tasks
workqueue. Visibility model is permissive today: every signed-in
user can see every task (matches the "All Tasks" tab in the design).
The "My Tasks" / "Assigned" tabs are pure scope filters at the
service layer.
"""
from __future__ import annotations

from datetime import datetime, timezone
from math import ceil
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.task import Task, TaskCategory, TaskPriority, TaskStatus
from app.models.user import User
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate


class TaskService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ----------------------------------------------------------------

    async def list(
        self,
        *,
        viewer_id: UUID,
        scope: str = "all",
        q: str | None = None,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
        category: TaskCategory | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> tuple[list[TaskOut], int, int]:
        stmt = select(Task)
        count_stmt = select(func.count(Task.id))

        if scope == "mine":
            stmt = stmt.where(Task.assigned_to_user_id == viewer_id)
            count_stmt = count_stmt.where(Task.assigned_to_user_id == viewer_id)
        elif scope == "assigned":
            # Tasks I created and assigned to someone else (outgoing).
            stmt = stmt.where(
                Task.created_by_user_id == viewer_id,
                or_(
                    Task.assigned_to_user_id.is_(None),
                    Task.assigned_to_user_id != viewer_id,
                ),
            )
            count_stmt = count_stmt.where(
                Task.created_by_user_id == viewer_id,
                or_(
                    Task.assigned_to_user_id.is_(None),
                    Task.assigned_to_user_id != viewer_id,
                ),
            )

        if q:
            like = f"%{q.strip()}%"
            cond = or_(Task.title.ilike(like), Task.description.ilike(like))
            stmt = stmt.where(cond)
            count_stmt = count_stmt.where(cond)
        if status is not None:
            stmt = stmt.where(Task.status == status)
            count_stmt = count_stmt.where(Task.status == status)
        if priority is not None:
            stmt = stmt.where(Task.priority == priority)
            count_stmt = count_stmt.where(Task.priority == priority)
        if category is not None:
            stmt = stmt.where(Task.category == category)
            count_stmt = count_stmt.where(Task.category == category)

        total = (await self.db.execute(count_stmt)).scalar_one()
        stmt = (
            stmt.order_by(Task.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self.db.execute(stmt)).scalars().all()

        items = [await self._project(t) for t in rows]
        pages = ceil(total / page_size) if page_size else 1
        return items, total, pages

    async def get(self, task_id: UUID) -> Task:
        task = await self.db.get(Task, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return task

    async def get_projected(self, task_id: UUID) -> TaskOut:
        task = await self.get(task_id)
        return await self._project(task)

    # ----------------------------------------------------------------

    async def create(
        self, *, viewer_id: UUID, payload: TaskCreate
    ) -> TaskOut:
        # Validate FK references upfront so we return a clean 404
        # rather than a constraint violation.
        if payload.assigned_to_user_id is not None:
            if not await self.db.get(User, payload.assigned_to_user_id):
                raise HTTPException(status_code=404, detail="Assignee not found")
        if payload.patient_id is not None:
            if not await self.db.get(Patient, payload.patient_id):
                raise HTTPException(status_code=404, detail="Patient not found")

        task = Task(
            title=payload.title,
            description=payload.description,
            category=TaskCategory(payload.category),
            priority=TaskPriority(payload.priority),
            status=TaskStatus.new,
            created_by_user_id=viewer_id,
            assigned_to_user_id=payload.assigned_to_user_id,
            patient_id=payload.patient_id,
            due_date=payload.due_date,
        )
        self.db.add(task)
        await self.db.flush()
        return await self._project(task)

    async def update(
        self, task_id: UUID, *, viewer_id: UUID, payload: TaskUpdate
    ) -> TaskOut:
        task = await self.get(task_id)
        data = payload.model_dump(exclude_unset=True)

        if "assigned_to_user_id" in data and data["assigned_to_user_id"] is not None:
            if not await self.db.get(User, data["assigned_to_user_id"]):
                raise HTTPException(status_code=404, detail="Assignee not found")
        if "patient_id" in data and data["patient_id"] is not None:
            if not await self.db.get(Patient, data["patient_id"]):
                raise HTTPException(status_code=404, detail="Patient not found")

        for k, v in data.items():
            if k == "category" and v is not None:
                task.category = TaskCategory(v)
            elif k == "priority" and v is not None:
                task.priority = TaskPriority(v)
            elif k == "status" and v is not None:
                new_status = TaskStatus(v)
                if (
                    new_status == TaskStatus.completed
                    and task.status != TaskStatus.completed
                ):
                    task.completed_at = datetime.now(timezone.utc)
                    task.completed_by_user_id = viewer_id
                elif (
                    new_status != TaskStatus.completed
                    and task.status == TaskStatus.completed
                ):
                    task.completed_at = None
                    task.completed_by_user_id = None
                task.status = new_status
            else:
                setattr(task, k, v)

        await self.db.flush()
        return await self._project(task)

    async def delete(self, task_id: UUID) -> None:
        task = await self.get(task_id)
        await self.db.delete(task)
        await self.db.flush()

    # ----------------------------------------------------------------

    async def _project(self, task: Task) -> TaskOut:
        creator_name: str | None = None
        if task.created_by_user_id is not None:
            u = await self.db.get(User, task.created_by_user_id)
            creator_name = (u.full_name or u.email) if u else None

        assignee_name: str | None = None
        if task.assigned_to_user_id is not None:
            u = await self.db.get(User, task.assigned_to_user_id)
            assignee_name = (u.full_name or u.email) if u else None

        patient_name: str | None = None
        if task.patient_id is not None:
            p = await self.db.get(Patient, task.patient_id)
            patient_name = (
                f"{p.first_name} {p.last_name}".strip() if p else None
            )

        return TaskOut(
            id=task.id,
            title=task.title,
            description=task.description,
            category=task.category.value,
            priority=task.priority.value,
            status=task.status.value,
            created_by_user_id=task.created_by_user_id,
            created_by_name=creator_name,
            assigned_to_user_id=task.assigned_to_user_id,
            assigned_to_name=assignee_name,
            patient_id=task.patient_id,
            patient_name=patient_name,
            due_date=task.due_date,
            completed_at=task.completed_at,
            completed_by_user_id=task.completed_by_user_id,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )
