from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.availability import UserAvailability
from app.models.user import User, UserRole
from app.schemas.availability import (
    AvailabilityCreate,
    AvailabilityOut,
    AvailabilityUpdate,
)
from app.services.audit_service import AuditService

router = APIRouter(prefix="/availability", tags=["availability"])


def _can_manage(actor: User, target_id: UUID) -> bool:
    """Admins manage anyone; everyone else manages only themselves."""
    return actor.role == UserRole.admin or actor.id == target_id


@router.get(
    "/me",
    response_model=list[AvailabilityOut],
)
async def list_my_availability(
    db: DbSession, current: CurrentUser
) -> list[AvailabilityOut]:
    return await _list_for_user(db, current.id)


@router.get(
    "/user/{user_id}",
    response_model=list[AvailabilityOut],
)
async def list_user_availability(
    user_id: UUID,
    db: DbSession,
    current: CurrentUser,
) -> list[AvailabilityOut]:
    if not _can_manage(current, user_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    return await _list_for_user(db, user_id)


async def _list_for_user(db, user_id: UUID) -> list[AvailabilityOut]:
    stmt = (
        select(UserAvailability)
        .where(UserAvailability.user_id == user_id)
        .order_by(UserAvailability.day_of_week.asc(), UserAvailability.start_time.asc())
    )
    items = (await db.execute(stmt)).scalars().all()
    return [AvailabilityOut.model_validate(i) for i in items]


@router.post(
    "/user/{user_id}",
    response_model=AvailabilityOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_for_user(
    user_id: UUID,
    payload: AvailabilityCreate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> AvailabilityOut:
    if not _can_manage(current, user_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    slot = UserAvailability(user_id=user_id, **payload.model_dump())
    db.add(slot)
    await db.flush()
    await db.refresh(slot)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="availability.create",
        resource_type="user_availability",
        resource_id=str(slot.id),
        payload={"user_id": str(user_id), **payload.model_dump()},
    )
    return AvailabilityOut.model_validate(slot)


@router.patch(
    "/{slot_id}",
    response_model=AvailabilityOut,
)
async def update_slot(
    slot_id: UUID,
    payload: AvailabilityUpdate,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> AvailabilityOut:
    slot = await db.get(UserAvailability, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if not _can_manage(current, slot.user_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(slot, k, v)
    if slot.end_time <= slot.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_time must be after start_time",
        )
    await db.flush()
    await db.refresh(slot)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="availability.update",
        resource_type="user_availability",
        resource_id=str(slot.id),
        payload=changes,
    )
    return AvailabilityOut.model_validate(slot)


@router.delete(
    "/{slot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_slot(
    slot_id: UUID,
    request: Request,
    db: DbSession,
    current: CurrentUser,
) -> None:
    slot = await db.get(UserAvailability, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if not _can_manage(current, slot.user_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    user_id = str(slot.user_id)
    await db.delete(slot)
    await db.flush()
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="availability.delete",
        resource_type="user_availability",
        resource_id=str(slot_id),
        payload={"user_id": user_id},
    )
