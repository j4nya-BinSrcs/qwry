import logging
from dataclasses import dataclass

import httpx

from server.src.api.schemas import SearchResponse, SearchResultItem

logger = logging.getLogger(__name__)


@dataclass
class EngineConfig:
    base_url: str
    timeout_seconds: float


class EngineClient:
    def __init__(self, http_client: httpx.AsyncClient, config: EngineConfig) -> None:
        self._client = http_client
        self._config = config

    async def search(self, q: str, page: int = 1, page_size: int = 10) -> SearchResponse:
        url = self._config.base_url.rstrip("/") + "/search"
        offset = (page - 1) * page_size
        params: dict[str, str | int] = {
            "q": q,
            "limit": page_size,
            "offset": offset,
        }

        logger.debug("Engine request", extra={"url": url, "params": params})

        try:
            resp = await self._client.get(
                url,
                params=params,
                timeout=self._config.timeout_seconds,
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.TimeoutException:
            logger.warning("Engine timeout", extra={"query": q})
            return self._empty_response(q, page, page_size, "engine")
        except httpx.HTTPStatusError as e:
            logger.error("Engine HTTP error", extra={"status": e.response.status_code, "query": q})
            return self._empty_response(q, page, page_size, "engine")
        except Exception as e:
            logger.error("Engine request failed", extra={"error": str(e), "query": q})
            return self._empty_response(q, page, page_size, "engine")

        raw_hits = data.get("hits", [])
        total = data.get("total_hits", 0)

        results = [
            SearchResultItem(
                title=h.get("title") or "",
                url=h.get("url", ""),
                snippet=h.get("snippet") or h.get("description") or "",
                source="engine",
            )
            for h in raw_hits
            if h.get("url")
        ]

        return SearchResponse(
            query=data.get("query", q),
            page=page,
            page_size=page_size,
            total_results=total or len(results),
            results=results,
            provider="engine",
        )

    def _empty_response(self, q: str, page: int, page_size: int, provider: str) -> SearchResponse:
        return SearchResponse(
            query=q,
            page=page,
            page_size=page_size,
            total_results=0,
            results=[],
            provider=provider,
        )
