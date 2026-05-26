from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

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


limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
)


def create_app() -> FastAPI:
    app = FastAPI(
        title=f"{settings.PROJECT_NAME} API",
        version="1.0.0",
        description="AI-native EHR/EMR backend",
        default_response_class=ORJSONResponse,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
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
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

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
