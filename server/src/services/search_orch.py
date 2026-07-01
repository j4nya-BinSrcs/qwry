import asyncio
import logging

import httpx

from server.src.api.schemas import SearchResponse, SearchResultItem
from server.src.core.config import settings
from server.src.core.registry import EndpointRegistry
from server.src.services.engine_proxy import EngineClient
from server.src.services.searxng import SearxngClient

logger = logging.getLogger(__name__)


class SearchOrchestrator:
    def __init__(self, http_client: httpx.AsyncClient, registry: EndpointRegistry) -> None:
        self._http = http_client
        self._searxng = SearxngClient(http_client, registry.searxng)
        self._engine = EngineClient(http_client, registry.engine)

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
        pass
