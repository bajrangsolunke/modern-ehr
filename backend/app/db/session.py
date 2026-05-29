from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# Async engine pool sizing. Defaults assume a single uvicorn worker;
# scale `pool_size` with `--workers`. `pool_recycle=1800` (30 min)
# avoids long-lived connections that get killed by Postgres's
# `idle_in_transaction_session_timeout` or load-balancer idle reaps
# — the previous setup hit `OperationalError: server closed connection`
# after long quiet periods. `pool_pre_ping` keeps the round-trip
# overhead negligible.
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_POOL_MAX_OVERFLOW,
    pool_recycle=1800,
    pool_timeout=30,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
