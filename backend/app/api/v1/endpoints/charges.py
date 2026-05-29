from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.charge import ChargeCreate, ChargeOut, ChargeVoidIn
from app.services.charge_service import ChargeService


router = APIRouter(prefix="/billing/charges", tags=["billing-charges"])


@router.post("", response_model=ChargeOut, status_code=status.HTTP_201_CREATED)
async def create_charge(
    payload: ChargeCreate, db: DbSession, current: CurrentUser
) -> ChargeOut:
    return await ChargeService(db).create(payload, viewer_id=current.id)


@router.get("/{charge_id}", response_model=ChargeOut)
async def get_charge(
    charge_id: UUID, db: DbSession, current: CurrentUser  # noqa: ARG001
) -> ChargeOut:
    return await ChargeService(db).get(charge_id)


@router.post("/{charge_id}/void", response_model=ChargeOut)
async def void_charge(
    charge_id: UUID,
    payload: ChargeVoidIn,
    db: DbSession,
    current: CurrentUser,
) -> ChargeOut:
    return await ChargeService(db).void(
        charge_id, viewer_id=current.id, reason=payload.reason
    )
