"""LLM client wrapper. Routes chat + embeddings to a configurable provider.

Supported providers (all speak the OpenAI-compatible Chat Completions API,
so the same `AsyncOpenAI` client works for every one — only `base_url`,
`api_key`, and the default model name change):

    LLM_PROVIDER=openai   → api.openai.com           (gpt-4o-mini default)
    LLM_PROVIDER=groq     → api.groq.com/openai/v1   (llama-3.3-70b default, FREE tier)
    LLM_PROVIDER=ollama   → http://localhost:11434/v1 (llama3.2:3b default, fully local)
    LLM_PROVIDER=stub     → no network, deterministic echo (CI / no-key dev)

If a provider is configured but its key is missing, we fall back to the
stub so local development and CI never break.

Embeddings are only available on `openai` and `ollama`. On `groq` we
fall back to a deterministic stub embedding (Groq has no embed endpoint
as of 2026-05 — RAG features should pin a separate provider if needed).
"""
from __future__ import annotations

from typing import Any, Literal

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)

Provider = Literal["openai", "groq", "ollama", "stub"]


# Per-provider defaults. Override at runtime via settings.LLM_MODEL_CHAT.
_DEFAULT_CHAT_MODELS: dict[str, str] = {
    "openai": "gpt-4o-mini",
    "groq": "llama-3.3-70b-versatile",
    "ollama": "llama3.2:3b",
}
_DEFAULT_EMBED_MODELS: dict[str, str] = {
    "openai": "text-embedding-3-small",
    "ollama": "nomic-embed-text",
}


class LLMClient:
    def __init__(self) -> None:
        self._client = None
        self._provider: Provider = self._resolve_provider()
        self._chat_model = settings.LLM_MODEL_CHAT or _DEFAULT_CHAT_MODELS.get(
            self._provider, "gpt-4o-mini"
        )
        self._embed_model = settings.LLM_MODEL_EMBED or _DEFAULT_EMBED_MODELS.get(
            self._provider, "text-embedding-3-small"
        )

        if self._provider == "stub":
            log.info("llm_stub_mode", reason="no provider configured")
            return

        try:
            from openai import AsyncOpenAI
        except ImportError:
            log.warning("openai_sdk_missing", provider=self._provider)
            self._provider = "stub"
            return

        base_url, api_key = self._provider_endpoint()
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        log.info(
            "llm_ready",
            provider=self._provider,
            chat_model=self._chat_model,
            embed_model=self._embed_model,
        )

    # ---------------------------------------------------------- public API

    @property
    def enabled(self) -> bool:
        return self._provider != "stub"

    @property
    def provider(self) -> Provider:
        return self._provider

    @property
    def chat_model(self) -> str:
        return self._chat_model

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        temperature: float = 0.2,
        max_tokens: int = 600,
        json_mode: bool = False,
    ) -> str:
        if not self._client:
            return self._stub_response(messages)

        kwargs: dict[str, Any] = {
            "model": model or self._chat_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        # Groq + recent OpenAI + Ollama all accept response_format=json_object,
        # but older Ollama builds reject it. Send only when asked.
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        try:
            res = await self._client.chat.completions.create(**kwargs)
            return res.choices[0].message.content or ""
        except Exception as exc:  # pragma: no cover - network-bound
            log.error("llm_error", provider=self._provider, error=str(exc))
            return self._stub_response(messages)

    async def embed(self, text: str) -> list[float]:
        # Groq has no embeddings endpoint — use stub so RAG-adjacent code
        # keeps running. Pin a different provider for real embeddings.
        if not self._client or self._provider == "groq":
            return self._stub_embedding(text)
        try:
            res = await self._client.embeddings.create(
                model=self._embed_model,
                input=text,
            )
            return list(res.data[0].embedding)
        except Exception as exc:  # pragma: no cover - network-bound
            log.error("embed_error", provider=self._provider, error=str(exc))
            return self._stub_embedding(text)

    # ----------------------------------------------------- provider config

    @staticmethod
    def _resolve_provider() -> Provider:
        """Pick provider from settings. Falls through to `stub` if the
        chosen provider has no usable credentials."""
        chosen = (settings.LLM_PROVIDER or "").strip().lower()

        if chosen == "groq":
            if settings.GROQ_API_KEY and settings.GROQ_API_KEY != "gsk-replace-me":
                return "groq"
            log.warning("groq_key_missing_falling_back_to_stub")
            return "stub"

        if chosen == "ollama":
            # Ollama runs locally and doesn't need a real key. We trust
            # the configured base URL; failures surface at first call.
            return "ollama"

        if chosen == "openai":
            if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY != "sk-replace-me":
                return "openai"
            log.warning("openai_key_missing_falling_back_to_stub")
            return "stub"

        # No explicit provider — try OpenAI for backwards compatibility,
        # else stub.
        if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY != "sk-replace-me":
            return "openai"
        return "stub"

    def _provider_endpoint(self) -> tuple[str | None, str]:
        """Return (base_url, api_key) for the active provider."""
        if self._provider == "groq":
            return ("https://api.groq.com/openai/v1", settings.GROQ_API_KEY)
        if self._provider == "ollama":
            # Any non-empty string works as the Ollama "key".
            return (settings.OLLAMA_BASE_URL, "ollama")
        # openai — pass None to use the SDK default
        return (None, settings.OPENAI_API_KEY)

    # ---------------------------------------------------------- stub paths

    @staticmethod
    def _stub_response(messages: list[dict[str, str]]) -> str:
        last = messages[-1]["content"] if messages else ""
        return (
            "[AI stub] Configure LLM_PROVIDER + key to enable real generation. "
            f"Echoing intent: {last[:140]}"
        )

    @staticmethod
    def _stub_embedding(text: str) -> list[float]:
        h = abs(hash(text))
        return [(h >> i) % 1000 / 1000.0 for i in range(1536)]


llm_client = LLMClient()
