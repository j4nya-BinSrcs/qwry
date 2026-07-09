import logging
from uuid import UUID

import httpx
from fastapi import Header, HTTPException, Query, Request
from server.src.api.schemas import (
    ItemSummaryResponse,
    SuggestResponse,
    SummarizeRequest,
    SummarizeResponse,
    SystemStats,
    WorkspaceCreateRequest,
    WorkspaceItemCreateRequest,
    WorkspaceItemResponse,
    WorkspaceItemUpdateRequest,
    WorkspaceResponse,
    WorkspaceUpdateRequest,
)
from server.src.core.registry import EndpointRegistry
from server.src.core.session import get_session_id
from server.src.services.stats_service import StatsCollector
from server.src.services.summarizer import Summarizer
from server.src.services.workspace_service import (
    add_item,
    create_workspace,
    delete_item,
    delete_workspace,
    get_workspace,
    list_items,
    list_workspaces,
    update_item,
    update_workspace,
)

logger = logging.getLogger(__name__)


# ── Health ─────────────────────────────────────────────────────────────


async def health():
    return {"status": "ok"}


# ── Search ─────────────────────────────────────────────────────────────


async def search(
    request: Request,
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Results per page"),
    provider: str | None = Query(None, description="Search provider override"),
):
    orchestrator = request.app.state.orchestrator
    logger.info(
        "Search request",
        extra={"query": q, "page": page, "page_size": page_size, "provider": provider},
    )
    return await orchestrator.search(q, page, page_size, provider)


# ── Suggest ────────────────────────────────────────────────────────────


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
        resp = await http.get(f"{base_url}/autocompleter", params={"q": q}, timeout=3.0)
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
        resp = await http.get(f"{base_url}/search", params={"q": q, "format": "json"}, timeout=3.0)
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
        resp = await http.get(f"{base_url}/search", params={"q": q, "limit": 5, "offset": 0}, timeout=timeout)
        if resp.is_success:
            data = resp.json()
            hits = data.get("hits", [])
            titles = [h["title"] for h in hits if h.get("title")]
            if titles:
                return titles, "engine"
    except Exception:
        pass
    return [], "none"


# ── Stats ──────────────────────────────────────────────────────────────


async def system_stats(request: Request) -> SystemStats:
    collector = StatsCollector(
        http_client=request.app.state.http,
        registry=request.app.state.registry,
        request_count=request.app.state.request_count,
        server_start=request.app.state.server_start,
    )
    return await collector.collect()


# ── Summarize ──────────────────────────────────────────────────────────


async def summarize(
    request: Request,
    body: SummarizeRequest,
) -> SummarizeResponse:
    summarizer: Summarizer = request.app.state.summarizer
    result = await summarizer.summarize_url(body.url)
    return SummarizeResponse(
        url=result.url,
        title=result.title,
        summary=result.summary,
        provider=result.provider,
        model=result.model,
    )


# ── Workspaces ─────────────────────────────────────────────────────────


async def _get_db_session(request: Request):
    maker = request.app.state.db
    async with maker() as session:
        yield session


async def workspace_list(
    request: Request,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> list[WorkspaceResponse]:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        return await list_workspaces(db, session_id)


async def workspace_create(
    request: Request,
    body: WorkspaceCreateRequest,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> WorkspaceResponse:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        return await create_workspace(db, session_id, body.name, body.description)


async def workspace_get(
    request: Request,
    ws_id: UUID,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> WorkspaceResponse:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        result = await get_workspace(db, session_id, ws_id)
    if not result:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return result


async def workspace_update(
    request: Request,
    ws_id: UUID,
    body: WorkspaceUpdateRequest,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> WorkspaceResponse:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        result = await update_workspace(db, session_id, ws_id, body.name, body.description)
    if not result:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return result


async def workspace_delete(
    request: Request,
    ws_id: UUID,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
):
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        ok = await delete_workspace(db, session_id, ws_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {"status": "deleted"}


async def item_list(
    request: Request,
    ws_id: UUID,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> list[WorkspaceItemResponse]:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        return await list_items(db, session_id, ws_id)


async def item_create(
    request: Request,
    ws_id: UUID,
    body: WorkspaceItemCreateRequest,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> WorkspaceItemResponse:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        try:
            result = await add_item(db, session_id, ws_id, body.url, body.title, body.snippet, body.source)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from None
    if not result:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return result


async def item_update(
    request: Request,
    item_id: UUID,
    body: WorkspaceItemUpdateRequest,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> WorkspaceItemResponse:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        result = await update_item(
            db,
            session_id,
            item_id,
            None,
            title=body.title,
            snippet=body.snippet,
            notes=body.notes,
        )
    if not result:
        raise HTTPException(status_code=404, detail="Item not found")
    return result


async def item_delete(
    request: Request,
    item_id: UUID,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
):
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        ok = await delete_item(db, session_id, item_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"status": "deleted"}


async def item_summarize(
    request: Request,
    item_id: UUID,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> ItemSummaryResponse:
    maker = request.app.state.db
    async with maker() as db:
        from server.src.db.repository import WorkspaceItemRepo

        item_repo = WorkspaceItemRepo(db)
        item = await item_repo.get_by_id(item_id)

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.summary:
        return ItemSummaryResponse(
            item_id=item.id,
            summary=item.summary,
            provider="cached",
            model="cached",
        )

    summarizer: Summarizer = request.app.state.summarizer
    result = await summarizer.summarize_url(item.url)
    async with maker() as db:
        await item_repo.update(item_id, summary=result.summary)
    return ItemSummaryResponse(
        item_id=item.id,
        summary=result.summary,
        provider=result.provider,
        model=result.model,
    )
