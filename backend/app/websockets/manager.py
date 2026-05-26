import asyncio
import json
from collections import defaultdict

from fastapi import WebSocket

from app.core.logging import get_logger

log = get_logger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections[user_id].add(ws)
        log.info("ws_connect", user_id=user_id, count=len(self._connections[user_id]))

    async def disconnect(self, user_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._connections[user_id].discard(ws)
            if not self._connections[user_id]:
                self._connections.pop(user_id, None)
        log.info("ws_disconnect", user_id=user_id)

    async def send_to_user(self, user_id: str, payload: dict) -> None:
        async with self._lock:
            sockets = list(self._connections.get(user_id, []))
        for ws in sockets:
            try:
                await ws.send_text(json.dumps(payload, default=str))
            except Exception as exc:  # pragma: no cover - network bound
                log.warning("ws_send_failed", error=str(exc))

    async def broadcast(self, payload: dict) -> None:
        async with self._lock:
            sockets = [s for group in self._connections.values() for s in group]
        message = json.dumps(payload, default=str)
        for ws in sockets:
            try:
                await ws.send_text(message)
            except Exception as exc:  # pragma: no cover - network bound
                log.warning("ws_broadcast_failed", error=str(exc))


ws_manager = ConnectionManager()
