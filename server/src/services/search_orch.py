import asyncio
import logging

import httpx

from server.src.api.schemas import SearchResponse, SearchResultItem
from server.src.core.config import settings
from server.src.services.engine_proxy import EngineClient, EngineConfig
from server.src.services.searxng import SearxngClient, SearxngConfig

logger = logging.getLogger(__name__)


class SearchOrchestrator:
    def __init__(self) -> None:
        self._http = httpx.AsyncClient()

        self._searxng = SearxngClient(
            self._http,
            SearxngConfig(
                base_url=settings.searxng_base_url,
                timeout_seconds=settings.searxng_timeout_seconds,
            ),
        )

        self._engine = EngineClient(
            self._http,
            EngineConfig(
                base_url=settings.engine_base_url,
                timeout_seconds=settings.engine_timeout_seconds,
            ),
        )

    async def search(
        self,
        q: str,
        page: int = 1,
        page_size: int = 10,
        provider: str | None = None,
    ) -> SearchResponse:
        resolved = provider or settings.default_search_provider

        if resolved == "searxng":
            return await self._searxng.search(q, page, page_size)
        elif resolved == "engine":
            return await self._engine.search(q, page, page_size)
        elif resolved in ("hybrid", "all"):
            return await self._search_hybrid(q, page, page_size)
        else:
            logger.warning("Unknown provider, falling back to searxng", extra={"provider": resolved})
            return await self._searxng.search(q, page, page_size)

    async def _search_hybrid(
        self,
        q: str,
        page: int,
        page_size: int,
    ) -> SearchResponse:
        searxng_task = self._searxng.search(q, page, page_size)
        engine_task = self._engine.search(q, page, page_size)

        searxng_resp, engine_resp = await asyncio.gather(
            searxng_task, engine_task, return_exceptions=True,
        )

        seen = set()
        merged: list[SearchResultItem] = []

        for resp in (searxng_resp, engine_resp):
            if isinstance(resp, SearchResponse):
                for r in resp.results:
                    if r.url not in seen:
                        seen.add(r.url)
                        merged.append(r)

        return SearchResponse(
            query=q,
            page=page,
            page_size=page_size,
            total_results=len(merged),
            results=merged[:page_size],
            provider="hybrid",
        )

    async def aclose(self) -> None:
        await self._http.aclose()
