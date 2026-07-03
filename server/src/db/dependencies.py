from collections.abc import AsyncGenerator

from fastapi import Request
from server.src.db import async_session_maker
from sqlalchemy.ext.asyncio import AsyncSession


async def get_db(request: Request) -> AsyncGenerator[AsyncSession]:
    session = async_session_maker()
    try:
        yield session
    finally:
        await session.close()
