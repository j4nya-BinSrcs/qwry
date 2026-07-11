import hashlib
import logging
from uuid import UUID

import httpx
from fastapi import Header, HTTPException, Query, Request, Response
from server.src.api.schemas import (
    ActivityLogItem,
    ChatRequest,
    ChatResponse,
    ChatSource,
    ItemSummaryResponse,
    LLMGenerateRequest,
    LLMGenerateResponse,
    OverviewResponse,
    ProfileResponse,
    ProfileUpdateRequest,
    ReaderResponse,
    ReadingListEntry,
    SearchHistoryItem,
    SuggestResponse,
    SummarizeRequest,
    SummarizeResponse,
    SummaryListEntry,
    SystemStats,
    WorkspaceCreateRequest,
    WorkspaceItemCreateRequest,
    WorkspaceItemResponse,
    WorkspaceItemUpdateRequest,
    WorkspaceResponse,
    WorkspaceUpdateRequest,
)
from server.src.core.config import settings
from server.src.core.registry import EndpointRegistry
from server.src.core.session import get_session_id
from server.src.services.cache import CacheService
from server.src.services.chat import ChatService
from server.src.services.reader import ReaderService
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
    categories: str | None = Query(None, description="SearXNG categories (comma-separated)"),
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
):
    orchestrator = request.app.state.orchestrator
    logger.info(
        "Search request",
        extra={"query": q, "page": page, "page_size": page_size, "provider": provider, "categories": categories},
    )
    result = await orchestrator.search(q, page, page_size, provider, categories)

    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        from server.src.services.profile_service import ProfileService

        svc = ProfileService(db)
        await svc.log_search(session_id, q, provider or result.provider)

    return result


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


# ── LLM Generate ───────────────────────────────────────────────────────


async def llm_generate(
    request: Request,
    body: LLMGenerateRequest,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> LLMGenerateResponse:
    cache: CacheService = request.app.state.cache
    llm = request.app.state.llm

    cache_key = hashlib.sha256(f"{body.query}|{body.mode}".encode()).hexdigest()
    if cache.available:
        cached = await cache.get(CacheService.NAMESPACE_LLM_OVERVIEW, cache_key)
        if cached:
            logger.debug("LLM overview cache hit", extra={"query": body.query, "mode": body.mode})
            return LLMGenerateResponse(response=cached)

    if body.mode == "elaborate":
        system = (
            "You are a search engine answer engine. You provide comprehensive, well-structured "
            "overviews using your own knowledge. "
            "Output only the overview — no greetings, no meta-commentary, no sign-offs. "
            "Never ask questions back, never offer follow-up assistance. "
            "Begin directly with the content."
        )
        prompt = (
            f"Provide a comprehensive, detailed overview of {body.query}. "
            f"Organize the overview with clear sections covering key facts, background, "
            f"notable details, and relevant context. Use your own knowledge."
        )

    elif body.mode == "study":
        system = (
            "You are a research assistant that synthesizes information from web pages "
            "into a clean, well-organized report. "
            "Output only the report — no greetings, no meta-commentary, no sign-offs."
        )
        reader = request.app.state.reader
        import asyncio

        async def _read_one(r):
            try:
                result = await reader.read_url(r.url)
                if result.success and result.content:
                    return f"Title: {r.title}\nURL: {r.url}\n\nContent:\n{result.content[:3000]}"
            except Exception:
                pass
            return None

        read_tasks = [_read_one(r) for r in body.results[:5]]
        read_results = await asyncio.gather(*read_tasks)
        contents = [c for c in read_results if c]

        if contents:
            items_text = "\n\n---\n\n".join(contents)
            prompt = (
                f"Search query: {body.query}\n\n"
                f"Here are the full contents extracted from the top search results:\n{items_text}\n\n"
                f"Synthesize a comprehensive, well-organized report based on these sources. "
                f"Extract key facts, data points, and insights from each source. "
                f"Cover different perspectives and highlight important details. "
                f"Cite sources by title."
            )
        else:
            prompt = (
                f"Provide a comprehensive, well-organized report on {body.query}. "
                f"Use your own knowledge."
            )
    else:
        system = (
            "You are a search engine answer engine. You provide concise, factual overviews "
            "directly answering the user's query. "
            "Output exactly one or two sentences (35-50 words total) — no more. "
            "Never introduce yourself, never ask questions back, never offer follow-up assistance. "
            "Never use phrases like 'I will...', 'I'd be happy to...', 'Would you like...', "
            "'If you would like them', 'Let me know', or any offer of further help. "
            "Begin directly with the answer."
        )
        prompt = (
            f"Provide a brief 35-50 word overview of {body.query} in 1-2 sentences. "
            f"Use your own knowledge. Output only the overview."
        )

    response = await llm.generate(prompt, system_prompt=system)

    if cache.available:
        ttl = getattr(settings, "cache_llm_ttl_seconds", 1800)
        await cache.set(CacheService.NAMESPACE_LLM_OVERVIEW, response, ttl, cache_key)

    if x_session_id and body.mode == "short":
        session_id = get_session_id(request)
        maker = request.app.state.db
        async with maker() as db:
            from server.src.services.profile_service import ProfileService

            svc = ProfileService(db)
            await svc.save_overview(session_id, body.query, response)

    return LLMGenerateResponse(response=response)


async def overview_get(
    request: Request,
    q: str = Query(..., min_length=1, description="Search query"),
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> OverviewResponse | None:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        from server.src.services.profile_service import ProfileService

        svc = ProfileService(db)
        entry = await svc.get_overview(session_id, q)
        if not entry:
            return None
        return OverviewResponse(query=entry.query, overview=entry.overview, created_at=entry.created_at)


# ── Stats ──────────────────────────────────────────────────────────────


async def system_stats(request: Request) -> SystemStats:
    collector = StatsCollector(
        http_client=request.app.state.http,
        registry=request.app.state.registry,
        request_count=request.app.state.request_count,
        server_start=request.app.state.server_start,
    )
    return await collector.collect()


# ── Image Proxy ────────────────────────────────────────────────────────


async def image_proxy(request: Request, url: str = Query(..., description="Image URL to proxy")):
    http: httpx.AsyncClient = request.app.state.http
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                " AppleWebKit/537.36 (KHTML, like Gecko)"
                " Chrome/127.0.0.0 Safari/537.36"
            ),
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "Referer": "https://www.google.com/",
        }
        resp = await http.get(url, headers=headers, follow_redirects=True, timeout=10.0)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "image/jpeg")
        return Response(content=resp.content, media_type=content_type)
    except Exception as e:
        logger.warning("Image proxy failed", extra={"url": url, "error": str(e)})
        raise HTTPException(status_code=502, detail="Failed to fetch image") from e


# ── Summarize ──────────────────────────────────────────────────────────


async def summarize(
    request: Request,
    body: SummarizeRequest,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> SummarizeResponse:
    summarizer: Summarizer = request.app.state.summarizer
    result = await summarizer.summarize_url(body.url)

    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        from server.src.services.profile_service import ProfileService

        svc = ProfileService(db)
        await svc.log_summary(
            session_id, result.url, result.title,
            source=result.provider if result.success else None,
            summary=result.summary if result.success else None,
            model=result.model if result.success else None,
        )

    return SummarizeResponse(
        url=result.url,
        title=result.title,
        summary=result.summary,
        provider=result.provider,
        model=result.model,
    )


# ── Reader ─────────────────────────────────────────────────────────────


async def read_url(
    request: Request,
    url: str = Query(..., description="URL to extract readable content from"),
    media_url: str | None = Query(None, description="Direct media URL (image/video) for content-type detection"),
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> ReaderResponse:
    reader: ReaderService = request.app.state.reader
    try:
        result = await reader.read_url(url, media_url)
    except Exception as e:
        logger.error("Reader endpoint failed", extra={"url": url, "error": repr(e)}, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Failed to read page: {e}") from e

    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        from server.src.services.profile_service import ProfileService

        svc = ProfileService(db)
        source = result.content_type if result.success else None
        await svc.log_read(
            session_id, url, result.title, source,
            content=result.content if result.success else None,
            content_type=result.content_type,
            media_url=result.media_url,
        )

    return ReaderResponse(
        url=result.url,
        title=result.title,
        content=result.content,
        content_length_chars=result.content_length_chars,
        reading_time_seconds=result.reading_time_seconds,
        success=result.success,
        error=result.error,
        content_type=result.content_type,
        media_url=result.media_url,
    )


# ── Workspace Chat ─────────────────────────────────────────────────────


async def workspace_chat(
    request: Request,
    ws_id: UUID,
    body: ChatRequest,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> ChatResponse:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        from server.src.db.repository import WorkspaceItemRepo, WorkspaceRepo

        ws_repo = WorkspaceRepo(db)
        ws = await ws_repo.get_by_session(ws_id, session_id)
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found")
        item_repo = WorkspaceItemRepo(db)
        items = await item_repo.list_by_workspace(ws_id)

    item_dicts = [{"url": it.url, "title": it.title, "snippet": it.snippet} for it in items]

    chat = ChatService(
        reader=request.app.state.reader,
        llm=request.app.state.llm,
    )
    result = await chat.answer(body.question, item_dicts)
    return ChatResponse(
        answer=result.answer,
        sources=[ChatSource(url=s.url, title=s.title) for s in result.sources],
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
            result = await add_item(
                db, session_id, ws_id, body.url, body.title, body.snippet, body.source, body.media_url
            )
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
            order_index=body.order_index,
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

    if item.summary and not item.summary.startswith(
        ("Summary generation failed", "Failed to fetch page", "No readable content")
    ):
        return ItemSummaryResponse(
            item_id=item.id,
            summary=item.summary,
            provider="cached",
            model="cached",
        )

    summarizer: Summarizer = request.app.state.summarizer
    result = await summarizer.summarize_url(item.url, item.title, item.snippet, item.media_url)

    if not result.success:
        raise HTTPException(status_code=502, detail=result.summary)

    async with maker() as db:
        await item_repo.update(item_id, summary=result.summary)
    return ItemSummaryResponse(
        item_id=item.id,
        summary=result.summary,
        provider=result.provider,
        model=result.model,
    )


# ── Profile ─────────────────────────────────────────────────────────────


async def profile_get(
    request: Request,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> ProfileResponse:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        from server.src.services.profile_service import ProfileService

        svc = ProfileService(db)
        profile = await svc.get_or_create_profile(session_id)
        return ProfileResponse(
            session_id=profile.session_id,
            username=profile.username,
            theme=profile.theme,
            search_provider=profile.search_provider,
            created_at=profile.created_at,
            last_active=profile.last_active,
        )


async def profile_update(
    request: Request,
    body: ProfileUpdateRequest,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> ProfileResponse:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        from server.src.services.profile_service import ProfileService

        svc = ProfileService(db)
        profile = await svc.update_profile(
            session_id,
            username=body.username,
            theme=body.theme,
            search_provider=body.search_provider,
        )
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        return ProfileResponse(
            session_id=profile.session_id,
            username=profile.username,
            theme=profile.theme,
            search_provider=profile.search_provider,
            created_at=profile.created_at,
            last_active=profile.last_active,
        )


# ── History ─────────────────────────────────────────────────────────────


async def history_search(
    request: Request,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> list[SearchHistoryItem]:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        from server.src.services.profile_service import ProfileService

        svc = ProfileService(db)
        entries = await svc.get_search_history(session_id)
        return [SearchHistoryItem(id=e.id, query=e.query, provider=e.provider, searched_at=e.searched_at) for e in entries]


async def history_reads(
    request: Request,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> list[ReadingListEntry]:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        from server.src.services.profile_service import ProfileService

        svc = ProfileService(db)
        entries = await svc.get_reading_list(session_id)
        return [
            ReadingListEntry(
                id=e.id, title=e.title, url=e.url, source=e.source,
                content=e.content, content_type=e.content_type, media_url=e.media_url,
                saved_at=e.saved_at,
            ) for e in entries
        ]


async def history_summaries(
    request: Request,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> list[SummaryListEntry]:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        from server.src.services.profile_service import ProfileService

        svc = ProfileService(db)
        entries = await svc.get_summary_list(session_id)
        return [
            SummaryListEntry(
                id=e.id, title=e.title, url=e.url, source=e.source,
                summary=e.summary, model=e.model,
                saved_at=e.saved_at,
            ) for e in entries
        ]


async def history_activity(
    request: Request,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> list[ActivityLogItem]:
    session_id = get_session_id(request)
    maker = request.app.state.db
    async with maker() as db:
        from server.src.services.profile_service import ProfileService

        svc = ProfileService(db)
        entries = await svc.get_activity_log(session_id)
        return [ActivityLogItem(id=e.id, action_type=e.action_type, details=e.details, created_at=e.created_at) for e in entries]
