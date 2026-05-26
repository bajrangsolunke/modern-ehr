from typing import Any
from uuid import UUID

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


class AuditService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def record(
        self,
        *,
        user_id: UUID | None,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> AuditLog:
        # JSONB can't hold native date/datetime/UUID/Enum/etc. — endpoints
        # often pass model_dump() output that contains them. Encode to
        # plain JSON-safe values up front so callers never have to think
        # about it.
        log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            payload=jsonable_encoder(payload) if payload is not None else None,
        )
        self.db.add(log)
        await self.db.flush()
        return log

    async def record_request(
        self,
        request: Request,
        *,
        user_id: UUID | None,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> AuditLog:
        """Same as `record`, but pulls ip_address + user_agent off the FastAPI
        Request so endpoint code doesn't have to wire those manually.

        IP precedence: X-Forwarded-For (first hop) → request.client.host → None.
        Reverse proxies must set X-Forwarded-For; otherwise client.host is the
        proxy itself, not the user.
        """
        return await self.record(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=_extract_ip(request),
            user_agent=request.headers.get("user-agent"),
            payload=payload,
        )


def _extract_ip(request: Request) -> str | None:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # First hop is the original client; subsequent hops are proxies.
        return xff.split(",")[0].strip() or None
    return request.client.host if request.client else None
