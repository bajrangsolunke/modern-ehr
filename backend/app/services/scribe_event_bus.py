"""Thread-safe per-session pub/sub for the scribe SSE stream.

Each ScribeSession gets its own `queue.Queue` keyed by session_id.
Publishers (chunk_transcriber, finalize_pipeline) call `publish(...)`
to push events; subscribers (the SSE endpoint, added in Phase 2)
consume via `subscribe(...)` which yields events as they arrive.

Events are plain dicts: {"type": "...", "data": {...}, "ts": <iso>}.
The `type` discriminator drives the FE's reducer. Common types:
- "transcript": {sequence, text, transcript_so_far}
- "stage":      {name: "soap|icd|summary|done", status: "started|completed|failed"}
- "error":      {message}
- "done":       (sentinel, closes the queue)

Phase 1 only needs publish/subscribe to exist + be unit-tested. The
SSE endpoint that consumes from subscribe() lands in Phase 2."""
from __future__ import annotations

import queue
import threading
from datetime import datetime, timezone
from typing import Any, Iterator
from uuid import UUID


_LOCK = threading.Lock()
_QUEUES: dict[str, queue.Queue[dict[str, Any] | None]] = {}


def _key(session_id: UUID | str) -> str:
    return str(session_id)


def _get_queue(session_id: UUID | str) -> queue.Queue[dict[str, Any] | None]:
    k = _key(session_id)
    with _LOCK:
        q = _QUEUES.get(k)
        if q is None:
            q = queue.Queue(maxsize=256)
            _QUEUES[k] = q
        return q


def publish(session_id: UUID | str, type_: str, data: dict[str, Any] | None = None) -> None:
    """Push an event onto the session's queue. Non-blocking — drops
    silently if the queue is full (safer than blocking the request)."""
    event: dict[str, Any] = {
        "type": type_,
        "data": data or {},
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    try:
        _get_queue(session_id).put_nowait(event)
    except queue.Full:
        # The subscriber is slow / disconnected. The next call to
        # subscribe() will see a sentinel; for now, drop.
        pass


def close(session_id: UUID | str) -> None:
    """Send the sentinel so any subscribers loop can break out, then
    drop the queue from the registry to free memory."""
    k = _key(session_id)
    with _LOCK:
        q = _QUEUES.pop(k, None)
    if q is not None:
        try:
            q.put_nowait(None)  # sentinel
        except queue.Full:
            pass


def subscribe(
    session_id: UUID | str, timeout_seconds: float = 30.0
) -> Iterator[dict[str, Any]]:
    """Yield events from this session's queue until close() is called
    (sentinel None) or `timeout_seconds` elapses with no events.

    The Phase-2 SSE endpoint will wrap this in an async generator using
    `run_in_executor`; here we keep it sync so the unit tests can drive
    it directly without an event loop."""
    q = _get_queue(session_id)
    while True:
        try:
            evt = q.get(timeout=timeout_seconds)
        except queue.Empty:
            return
        if evt is None:
            return
        yield evt


def queue_size(session_id: UUID | str) -> int:
    """Test helper — how many events are buffered for this session."""
    return _get_queue(session_id).qsize()


def reset_for_tests() -> None:
    """Clear all queues. Tests must call this in teardown so per-session
    state doesn't bleed across cases."""
    with _LOCK:
        _QUEUES.clear()
