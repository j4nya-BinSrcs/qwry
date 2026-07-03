import logging

from server.src.db.models import Base
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

logger = logging.getLogger(__name__)

engine = None
async_session_maker = None


def _make_async_url(database_url: str) -> str:
    if database_url.startswith("postgresql+asyncpg://"):
        return database_url
    if database_url.startswith("postgres://"):
        rest = database_url.removeprefix("postgres://")
        return f"postgresql+asyncpg://{rest}"
    if database_url.startswith("postgresql://"):
        rest = database_url.removeprefix("postgresql://")
        return f"postgresql+asyncpg://{rest}"
    return database_url


async def init_db(database_url: str) -> None:
    global engine, async_session_maker

    async_url = _make_async_url(database_url)
    safe_url = async_url.replace(async_url.split("@")[-1], "****") if "@" in async_url else async_url
    logger.info("Initializing database connection", extra={"url": safe_url})

    engine = create_async_engine(async_url, pool_size=5, max_overflow=10, echo=False)
    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Database tables created / verified")


async def close_db() -> None:
    global engine
    if engine:
        await engine.dispose()
        logger.info("Database connection closed")
