from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.analytics import DashboardSnapshot
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/snapshot", response_model=DashboardSnapshot)
async def snapshot(db: DbSession, current: CurrentUser) -> DashboardSnapshot:
    return await AnalyticsService(db).snapshot()
