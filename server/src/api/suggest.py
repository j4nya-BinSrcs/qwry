import logging

import httpx
from fastapi import APIRouter, Query, Request
from server.src.api.schemas import SuggestResponse
from server.src.core.registry import EndpointRegistry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["suggest"])


@router.get("/suggest", response_model=SuggestResponse)
async def suggest(
    request: Request,
    q: str = Query(..., min_length=1, description="Query prefix"),
) -> SuggestResponse:
    http: httpx.AsyncClient = request.app.state.http
    registry: EndpointRegistry = request.app.state.registry

    suggestions: list[str] = []
    source = "none"

    suggestions, source = await _try_searxng_autocompleter(http, registry.searxng.base_url, q)
    if not suggestions:
        suggestions, source = await _try_searxng_search_suggestions(http, registry.searxng.base_url, q)
    if not suggestions:
        suggestions, source = await _try_engine_search_suggestions(
            http,
            registry.engine.base_url,
            q,
            registry.engine.timeout,
        )

    return SuggestResponse(query=q, suggestions=suggestions[:10], source=source)


async def _try_searxng_autocompleter(
    http: httpx.AsyncClient,
    base_url: str,
    q: str,
) -> tuple[list[str], str]:
    try:
        resp = await http.get(
            f"{base_url}/autocompleter",
            params={"q": q},
            timeout=3.0,
        )
        if resp.is_success:
            data = resp.json()
            if isinstance(data, list) and len(data) >= 2 and isinstance(data[1], list):
                return data[1], "searxng_autocompleter"
    except Exception:
        pass
    return [], "none"


async def _try_searxng_search_suggestions(
    http: httpx.AsyncClient,
    base_url: str,
    q: str,
) -> tuple[list[str], str]:
    try:
        resp = await http.get(
            f"{base_url}/search",
            params={"q": q, "format": "json"},
            timeout=3.0,
        )
        if resp.is_success:
            data = resp.json()
            if "suggestions" in data and isinstance(data["suggestions"], list):
                return data["suggestions"], "searxng_search"
    except Exception:
        pass
    return [], "none"


async def _try_engine_search_suggestions(
    http: httpx.AsyncClient,
    base_url: str,
    q: str,
    timeout: float,
) -> tuple[list[str], str]:
    try:
        resp = await http.get(
            f"{base_url}/search",
            params={"q": q, "limit": 5, "offset": 0},
            timeout=timeout,
        )
        if resp.is_success:
            data = resp.json()
            hits = data.get("hits", [])
            titles = [h["title"] for h in hits if h.get("title")]
            if titles:
                return titles, "engine"
    except Exception:
        pass
    return [], "none"
