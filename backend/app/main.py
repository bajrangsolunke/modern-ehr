from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.rate_limit import limiter

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware

configure_logging()
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    log.info("startup", env=settings.ENVIRONMENT, project=settings.PROJECT_NAME)
    yield
    log.info("shutdown")


def create_app() -> FastAPI:
    # Auto-generated docs are convenient in dev but expose surface area
    # in production. Disable them when ENVIRONMENT != development.
    is_dev = settings.ENVIRONMENT == "development"
    app = FastAPI(
        title=f"{settings.PROJECT_NAME} API",
        version="1.0.0",
        description="AI-native EHR/EMR backend",
        default_response_class=ORJSONResponse,
        docs_url="/docs" if is_dev else None,
        redoc_url="/redoc" if is_dev else None,
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json" if is_dev else None,
        lifespan=lifespan,
    )

    app.state.limiter = limiter
    app.add_exception_handler(
        RateLimitExceeded,
        lambda request, exc: ORJSONResponse(
            {"detail": "Rate limit exceeded"}, status_code=429
        ),
    )
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    # CORS — keep dev permissive (any localhost port for Vite HMR),
    # narrow in non-dev to the explicit verbs + headers we actually use.
    # `allow_credentials=True` REQUIRES an explicit origin list (no wildcards).
    cors_kwargs: dict = {
        "allow_credentials": True,
        "allow_methods": (
            ["*"]
            if settings.ENVIRONMENT == "development"
            else ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
        ),
        "allow_headers": (
            ["*"]
            if settings.ENVIRONMENT == "development"
            else [
                "Authorization",
                "Content-Type",
                "Accept",
                "X-Request-ID",
            ]
        ),
        "expose_headers": ["X-Request-ID"],
    }
    if settings.ENVIRONMENT == "development":
        cors_kwargs["allow_origin_regex"] = r"http://(localhost|127\.0\.0\.1):\d+"
    else:
        cors_kwargs["allow_origins"] = settings.cors_origins
    app.add_middleware(CORSMiddleware, **cors_kwargs)

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/")
    async def root() -> dict:
        return {
            "name": settings.PROJECT_NAME,
            "version": "1.0.0",
            "docs": "/docs",
            "openapi": f"{settings.API_V1_PREFIX}/openapi.json",
        }

    return app


app = create_app()
