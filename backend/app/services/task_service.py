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
from app.models.task import Task, TaskCategory, TaskPriority, TaskStatus, TaskType
from app.models.user import User
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate
from app.services.notification_service import NotificationService


class TaskService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ----------------------------------------------------------------

    async def list(
        self,
        *,
        viewer_id: UUID,
        scope: str = "all",
        audience: str = "all",
        q: str | None = None,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
        category: TaskCategory | None = None,
        page: int = 1,
        page_size: int = 10,
        restrict_to_viewer: bool = False,
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
        elif restrict_to_viewer:
            # Non-admin "all" view = anything I'm assigned to OR
            # anything I created. Admins skip this branch and see
            # every task in the system.
            mine_or_mine = or_(
                Task.assigned_to_user_id == viewer_id,
                Task.created_by_user_id == viewer_id,
            )
            stmt = stmt.where(mine_or_mine)
            count_stmt = count_stmt.where(mine_or_mine)

        # Audience maps 1:1 onto the persisted task_type enum — no
        # more inferring from FK presence.
        if audience == "patients":
            stmt = stmt.where(Task.task_type == TaskType.patient)
            count_stmt = count_stmt.where(Task.task_type == TaskType.patient)
        elif audience == "users":
            stmt = stmt.where(Task.task_type == TaskType.user)
            count_stmt = count_stmt.where(Task.task_type == TaskType.user)

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
            task_type=TaskType(payload.task_type),
            created_by_user_id=viewer_id,
            assigned_to_user_id=payload.assigned_to_user_id,
            patient_id=payload.patient_id,
            due_date=payload.due_date,
        )
        self.db.add(task)
        await self.db.flush()

        # Notify the assignee (but not the creator if they assigned to
        # themselves — that's a silent self-task).
        if (
            payload.assigned_to_user_id is not None
            and payload.assigned_to_user_id != viewer_id
        ):
            await self._notify_assignment(task, assigner_id=viewer_id)

        return await self._project(task)

    async def update(
        self, task_id: UUID, *, viewer_id: UUID, payload: TaskUpdate
    ) -> TaskOut:
        task = await self.get(task_id)
        data = payload.model_dump(exclude_unset=True)
        prior_assignee = task.assigned_to_user_id

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
            elif k == "task_type" and v is not None:
                task.task_type = TaskType(v)
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

        # Reassignment fires the same notification the create path does.
        if (
            task.assigned_to_user_id is not None
            and task.assigned_to_user_id != prior_assignee
            and task.assigned_to_user_id != viewer_id
        ):
            await self._notify_assignment(task, assigner_id=viewer_id)

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
            task_type=task.task_type.value,
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

    # ---------------------------------------------------------------- notify

    async def _notify_assignment(self, task: Task, *, assigner_id: UUID) -> None:
        """Fire a `task_assigned` notification to the new assignee. High
        priority tasks ride the `high` urgency rail so the FE pops an
        OS toast if the recipient's tab is hidden."""
        assigner = await self.db.get(User, assigner_id)
        assigner_name = (
            (assigner.full_name or assigner.email) if assigner else "Someone"
        )
        urgency = "high" if task.priority == TaskPriority.high else "normal"
        body = (
            f"Assigned by {assigner_name}"
            + (
                f" · Due {task.due_date.isoformat()}"
                if task.due_date is not None
                else ""
            )
        )
        # `audience` routes the link to the right tab on the Tasks page.
        audience = "patients" if task.task_type == TaskType.patient else "users"
        await NotificationService(self.db).dispatch(
            recipient_id=task.assigned_to_user_id,
            kind="task_assigned",
            urgency=urgency,
            title=f"New task: {task.title}",
            body=body,
            related_type="task",
            related_id=task.id,
            link=f"/tasks?audience={audience}",
        )
