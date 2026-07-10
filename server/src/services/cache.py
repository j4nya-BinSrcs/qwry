import json
import logging
from typing import Any

from redis.asyncio import Redis as AsyncRedis
from redis.typing import EncodableT
from server.src.core.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    NAMESPACE_SEARCH = "search"
    NAMESPACE_SUMMARY = "summary"

    def __init__(self) -> None:
        self._client: AsyncRedis | None = None

    async def connect(self) -> None:
        if not settings.cache_enabled:
            logger.info("Cache disabled")
            return
        try:
            self._client = AsyncRedis(
                host=settings.valkey_host,
                port=settings.valkey_port,
                decode_responses=True,
            )
            await self._client.ping()
            logger.info(
                "Connected to Valkey",
                extra={"host": settings.valkey_host, "port": settings.valkey_port},
            )
        except Exception as e:
            logger.warning("Valkey unavailable, running without cache", extra={"error": str(e)})
            self._client = None

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    @property
    def available(self) -> bool:
        return self._client is not None

    def _key(self, namespace: str, *parts: str) -> str:
        return f"qwry:{namespace}:{'|'.join(parts)}"

    async def get(self, namespace: str, *parts: str) -> Any | None:
        if not self._client:
            return None
        key = self._key(namespace, *parts)
        raw = await self._client.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw

    async def set(self, namespace: str, value: Any, ttl: int, *parts: str) -> None:
        if not self._client:
            return
        key = self._key(namespace, *parts)
        raw: EncodableT = value if isinstance(value, str) else json.dumps(value, default=str)
        await self._client.setex(key, ttl, raw)

    async def invalidate(self, namespace: str, *parts: str) -> None:
        if not self._client:
            return
        key = self._key(namespace, *parts)
        await self._client.delete(key)
