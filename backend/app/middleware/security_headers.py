"""Security-header middleware. Headers tuned per OWASP Secure Headers
project + HIPAA §164.312(e)(1). HSTS + CSP are gated on non-dev so
local dev (HTTP, Vite HMR, sourcemaps) isn't broken by them."""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings


# Conservative starter CSP — locks scripts and styles to same-origin
# plus the two CDNs the app actually hits (Google Fonts). `unsafe-
# inline` on style-src is required by Tailwind's runtime-emitted
# styles; once those are pre-compiled and hash-pinned we can tighten
# this. WS origins use the same host so `ws:`/`wss:` self is enough.
_CSP_DIRECTIVES = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
]


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        # Always on — cheap, no compatibility risk.
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"

        # HSTS + CSP only outside dev. HSTS over plain HTTP would
        # break local dev forever (browsers cache it for the
        # max-age); CSP without 'unsafe-eval' breaks Vite HMR.
        if settings.ENVIRONMENT != "development":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
            response.headers["Content-Security-Policy"] = "; ".join(
                _CSP_DIRECTIVES
            )
        return response
