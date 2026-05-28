"""Speech-to-text wrapper using Groq's Whisper-compatible endpoint.

Groq exposes whisper-large-v3 (and -turbo) via an OpenAI-compatible
`audio.transcriptions.create` call. We pin English by default — short
chunks of accented English get badly mis-detected without language=en.

The transcribe() function returns plain text and is stateless. The
audio bytes are never persisted to disk; the caller handles cleanup."""
from __future__ import annotations

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


WHISPER_MODEL = "whisper-large-v3-turbo"


async def transcribe(audio_bytes: bytes, filename: str, language: str = "en") -> str:
    """Transcribe `audio_bytes` (a WebM / MP3 / WAV chunk) via Groq Whisper.

    Returns plain transcript text. Empty string on failure (the caller
    decides whether to surface this to the user or retry — the live
    chunked pipeline ignores empty fragments)."""
    try:
        from openai import AsyncOpenAI
    except ImportError:
        log.warning("openai_sdk_missing_in_stt")
        return ""

    api_key = settings.GROQ_API_KEY
    if not api_key or api_key == "gsk-replace-me":
        log.warning("stt_disabled_no_key")
        return ""

    client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
    )
    try:
        # The Groq SDK call requires a file-like with a filename, so we
        # use a (name, bytes) tuple — the SDK uploads it as multipart.
        res = await client.audio.transcriptions.create(
            model=WHISPER_MODEL,
            file=(filename, audio_bytes),
            language=language,
            response_format="text",
        )
        # The SDK returns either a string (response_format="text") or
        # an object with .text. Normalise.
        if isinstance(res, str):
            return res.strip()
        return getattr(res, "text", "").strip()
    except Exception as exc:  # pragma: no cover — network-bound
        log.error("stt_error", error=str(exc))
        return ""
