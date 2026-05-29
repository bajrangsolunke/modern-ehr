"""Health endpoints.

  - `/health`        → liveness. Returns 200 as long as the process is
                       up. Cheap, no I/O. Used by load balancers.
  - `/health/ready`  → readiness. Pings the DB + Redis. Returns 200
                       only when the app can actually serve traffic.
                       Used by k8s readinessProbe + Docker HEALTHCHECK
                       so unhealthy pods are taken out of rotation.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from app.api.deps import DbSession
from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.common import HealthResponse

log = get_logger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(timestamp=datetime.now(timezone.utc))


@router.get("/health/ready")
async def health_ready(db: DbSession) -> dict:
    """Deep readiness check. Probes the two dependencies that, if
    unavailable, mean we cannot serve traffic correctly: Postgres and
    Redis. Each check times out after ~2s so a stuck dependency
    doesn't block the probe itself.

    On any failure returns 503 with a `checks` payload identifying
    which dependency is sick. k8s + Docker honor the non-200 and
    pull the pod out of rotation.
    """
    checks: dict[str, str] = {}
    healthy = True

    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:  # noqa: BLE001
        log.warning("readiness_db_failed", error=str(exc))
        checks["database"] = "fail"
        healthy = False

    try:
        from redis import asyncio as redis_asyncio

        client = redis_asyncio.from_url(
            settings.REDIS_URL, socket_timeout=2, socket_connect_timeout=2
        )
        try:
            pong = await client.ping()
            checks["redis"] = "ok" if pong else "fail"
            if not pong:
                healthy = False
        finally:
            await client.aclose()
    except Exception as exc:  # noqa: BLE001
        log.warning("readiness_redis_failed", error=str(exc))
        checks["redis"] = "fail"
        healthy = False

    body = {
        "status": "ready" if healthy else "not_ready",
        "checks": checks,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if not healthy:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=body
        )
    return body
