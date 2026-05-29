"""Thin async wrapper around the Daily.co REST API.

We use only three endpoints:
  * POST /rooms — create a fresh room per appointment
  * POST /meeting-tokens — mint a short-lived join token per user
  * DELETE /rooms/{name} — clean up after the call ends

`enable_transcription_storage` is OFF — we don't want Daily to keep
a copy. Our backend already stores every transcript segment in our
own DB, which is HIPAA-controlled.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings


DAILY_API = "https://api.daily.co/v1"


class DailyClient:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or settings.DAILY_API_KEY
        if not self.api_key:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Telehealth is not configured. Set DAILY_API_KEY in "
                    "the backend env."
                ),
            )

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def create_room(self, *, ttl_seconds: int = 60 * 60 * 4) -> dict[str, Any]:
        """Create a private room with transcription enabled.

        `ttl_seconds` is wall-clock; rooms auto-delete after this
        even if we forget to call `delete_room`. Default = 4h, enough
        for the longest realistic appointment + buffer.
        """
        # 12-char URL-safe random name → unguessable, fits well in URLs
        name = secrets.token_urlsafe(9)  # ~12 chars
        exp = int(
            (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).timestamp()
        )
        payload = {
            "name": name,
            "privacy": "private",
            "properties": {
                "exp": exp,
                "enable_chat": False,
                "enable_screenshare": True,
                "enable_knocking": True,
                # `transcription_provider` + `enable_transcription_storage`
                # are Scale/HIPAA-plan properties — Daily's free tier
                # rejects them with "invalid property name". We start
                # transcription from the client via startTranscription()
                # instead; that call silently no-ops on plans without
                # the Transcription add-on.
            },
        }
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                f"{DAILY_API}/rooms",
                json=payload,
                headers=self._headers(),
            )
        if res.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail=f"Daily.co create_room failed: {res.text}",
            )
        return res.json()

    async def create_meeting_token(
        self,
        *,
        room_name: str,
        user_name: str,
        is_owner: bool,
        ttl_seconds: int = 60 * 60 * 2,
    ) -> str:
        """Mint a short-lived join token. `is_owner=True` for the
        provider — only owners can start/stop transcription, eject
        participants, etc."""
        exp = int(
            (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).timestamp()
        )
        payload = {
            "properties": {
                "room_name": room_name,
                "user_name": user_name,
                "is_owner": is_owner,
                "exp": exp,
            }
        }
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                f"{DAILY_API}/meeting-tokens",
                json=payload,
                headers=self._headers(),
            )
        if res.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail=f"Daily.co create_meeting_token failed: {res.text}",
            )
        return res.json()["token"]

    async def delete_room(self, room_name: str) -> None:
        """Best-effort cleanup — we don't fail the End-visit flow if
        Daily returns 404 (room already auto-expired)."""
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.delete(
                f"{DAILY_API}/rooms/{room_name}",
                headers=self._headers(),
            )
        if res.status_code not in (200, 204, 404):
            # Log only — don't bubble an error to the user.
            from structlog import get_logger
            get_logger().warning(
                "daily.delete_room_failed",
                room_name=room_name,
                status=res.status_code,
                body=res.text[:200],
            )
