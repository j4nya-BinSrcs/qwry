import logging
from dataclasses import dataclass

import httpx

from server.src.api.schemas import SearchResponse, SearchResultItem

logger = logging.getLogger(__name__)


@dataclass
class SearxngConfig:
    base_url: str
    timeout_seconds: float


class SearxngClient:
    def __init__(self, http_client: httpx.AsyncClient, config: SearxngConfig) -> None:
        self._client = http_client
        self._config = config

    async def search(self, q: str, page: int = 1, page_size: int = 10) -> SearchResponse:
        url = self._config.base_url.rstrip("/") + "/search"
        params: dict[str, str | int] = {
            "q": q,
            "format": "json",
            "pageno": page,
        }

        logger.debug("SearXNG request", extra={"url": url, "params": params})

        try:
            resp = await self._client.get(
                url,
                params=params,
                timeout=self._config.timeout_seconds,
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.TimeoutException:
            logger.warning("SearXNG timeout", extra={"query": q})
            return self._empty_response(q, page, page_size, "searxng")
        except httpx.HTTPStatusError as e:
            logger.error("SearXNG HTTP error", extra={"status": e.response.status_code, "query": q})
            return self._empty_response(q, page, page_size, "searxng")
        except Exception as e:
            logger.error("SearXNG request failed", extra={"error": str(e), "query": q})
            return self._empty_response(q, page, page_size, "searxng")

        raw_results = data.get("results", [])
        total = data.get("number_of_results", 0)

        results = [
            SearchResultItem(
                title=r.get("title", ""),
                url=r.get("url", ""),
                snippet=r.get("content", ""),
                source=r.get("engine", "searxng"),
            )
            for r in raw_results
            if r.get("url")
        ]

        return SearchResponse(
            query=data.get("query", q),
            page=page,
            page_size=page_size,
            total_results=total or len(results),
            results=results,
            provider="searxng",
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
