from typing import AsyncGenerator

from fastapi import Request
import asyncpg
from asyncpg import Connection
from api.settings import settings

async def create_db_pool() -> asyncpg.Pool:

    return asyncpg.create_pool(settings.DATABASE_URL, min_size=5)


async def get_db(request: Request) -> AsyncGenerator[
    Connection, None
]:

    async with request.app.state.pool.acquire() as connection:
        yield connection