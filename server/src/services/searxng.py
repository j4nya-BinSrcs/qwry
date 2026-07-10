import logging

import httpx
from server.src.api.schemas import SearchResponse, SearchResultItem
from server.src.core.registry import Backend

logger = logging.getLogger(__name__)


class SearxngClient:
    def __init__(self, http_client: httpx.AsyncClient, backend: Backend) -> None:
        self._client = http_client
        self._backend = backend

    async def search(self, q: str, page: int = 1, page_size: int = 10) -> SearchResponse:
        url = f"{self._backend.base_url}/search"
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
                timeout=self._backend.timeout,
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
                img_src=r.get("img_src"),
                thumbnail=r.get("thumbnail"),
                published_date=r.get("publishedDate"),
                category=r.get("category"),
                engine=r.get("engine"),
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
            suggestions=data.get("suggestions", []),
            infoboxes=data.get("infoboxes", []),
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
