from math import ceil
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select

from app.api.deps import CurrentUser, DbSession, require_roles
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.common import Page
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services.audit_service import AuditService

# User management is admin-only across the board.
admin_only = Depends(require_roles(UserRole.admin))

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "",
    response_model=Page[UserOut],
    dependencies=[admin_only],
)
async def list_users(
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001 — auth check
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, description="Search name or email"),
    role: UserRole | None = None,
    is_active: bool | None = None,
) -> Page[UserOut]:
    stmt = select(User)
    count_stmt = select(func.count(User.id))

    if q:
        needle = f"%{q.strip()}%"
        cond = or_(User.full_name.ilike(needle), User.email.ilike(needle))
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if role is not None:
        stmt = stmt.where(User.role == role)
        count_stmt = count_stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))
        count_stmt = count_stmt.where(User.is_active.is_(is_active))

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = (
        stmt.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(stmt)).scalars().all()
    return Page[UserOut](
        items=[UserOut.model_validate(u) for u in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 1,
    )


@router.post(
    "",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[admin_only],
)
async def create_user(
    payload: UserCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> UserOut:
    existing = (
        await db.execute(select(User).where(User.email == payload.email))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        specialty=payload.specialty,
        avatar_url=payload.avatar_url,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="user.create",
        resource_type="user",
        resource_id=str(user.id),
        payload={"email": user.email, "role": user.role.value},
    )
    return UserOut.model_validate(user)


@router.get(
    "/{user_id}",
    response_model=UserOut,
    dependencies=[admin_only],
)
async def get_user(
    user_id: UUID,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> UserOut:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.patch(
    "/{user_id}",
    response_model=UserOut,
    dependencies=[admin_only],
)
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> UserOut:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Refuse to lock yourself out of admin.
    if user.id == current.id and payload.role is not None and payload.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can't demote yourself from admin",
        )
    if user.id == current.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can't deactivate your own account",
        )

    changes = payload.model_dump(exclude_unset=True)
    new_password = changes.pop("password", None)

    for k, v in changes.items():
        setattr(user, k, v)
    if new_password:
        user.hashed_password = hash_password(new_password)

    await db.flush()
    await db.refresh(user)

    # Don't put the password in the audit log payload.
    audit_payload = {k: (v.value if hasattr(v, "value") else v) for k, v in changes.items()}
    if new_password:
        audit_payload["password"] = "<rotated>"
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="user.update",
        resource_type="user",
        resource_id=str(user.id),
        payload=audit_payload,
    )
    return UserOut.model_validate(user)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[admin_only],
)
async def deactivate_user(
    user_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    """
    Soft-delete: flip is_active=false so audit trails stay intact.
    Returning 204 keeps the row in place.
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can't deactivate your own account",
        )
    if not user.is_active:
        # Idempotent — already deactivated.
        return None
    user.is_active = False
    await db.flush()
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="user.deactivate",
        resource_type="user",
        resource_id=str(user.id),
        payload={"email": user.email},
    )
