"""Provider/admin dashboard endpoint.

Returns the data behind the right-rail cards on the dashboard:
  * Requested tasks for the signed-in user
  * Unread messages summary + recent activity

The aggregate is small + viewer-specific, so we cache nothing here —
React Query handles short-lived freshness on the client.
"""
from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.dashboard import DashboardSnapshot
from app.services.dashboard_service import DashboardService


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardSnapshot)
async def get_dashboard(
    db: DbSession,
    current: CurrentUser,
) -> DashboardSnapshot:
    return await DashboardService(db).snapshot(viewer_id=current.id)
