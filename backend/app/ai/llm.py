"""LLM client wrapper. Uses OpenAI when configured, otherwise a deterministic stub.

The stub keeps local development and CI working without an API key, while
production gets real model output as soon as OPENAI_API_KEY is set.
"""
from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


class LLMClient:
    def __init__(self) -> None:
        self._client = None
        self._enabled = bool(
            settings.OPENAI_API_KEY and settings.OPENAI_API_KEY != "sk-replace-me"
        )
        if self._enabled:
            try:
                from openai import AsyncOpenAI

                self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            except ImportError:
                log.warning("openai_unavailable", reason="package not installed")
                self._enabled = False

    @property
    def enabled(self) -> bool:
        return self._enabled

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        temperature: float = 0.2,
        max_tokens: int = 600,
        json_mode: bool = False,
    ) -> str:
        if not self._enabled or not self._client:
            return self._stub_response(messages)

        kwargs: dict[str, Any] = {
            "model": model or settings.OPENAI_MODEL_CHAT,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        try:
            res = await self._client.chat.completions.create(**kwargs)
            return res.choices[0].message.content or ""
        except Exception as exc:  # pragma: no cover - network-bound
            log.error("llm_error", error=str(exc))
            return self._stub_response(messages)

    async def embed(self, text: str) -> list[float]:
        if not self._enabled or not self._client:
            return self._stub_embedding(text)
        try:
            res = await self._client.embeddings.create(
                model=settings.OPENAI_MODEL_EMBED,
                input=text,
            )
            return list(res.data[0].embedding)
        except Exception as exc:  # pragma: no cover - network-bound
            log.error("embed_error", error=str(exc))
            return self._stub_embedding(text)

    @staticmethod
    def _stub_response(messages: list[dict[str, str]]) -> str:
        last = messages[-1]["content"] if messages else ""
        return (
            "[AI stub] Configure OPENAI_API_KEY to enable real generation. "
            f"Echoing intent: {last[:140]}"
        )

    @staticmethod
    def _stub_embedding(text: str) -> list[float]:
        h = abs(hash(text))
        return [(h >> i) % 1000 / 1000.0 for i in range(1536)]


llm_client = LLMClient()
