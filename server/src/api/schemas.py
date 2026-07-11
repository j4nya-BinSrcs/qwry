from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SearchResultItem(BaseModel):
    title: str
    url: str
    snippet: str
    source: str
    img_src: str | None = None
    thumbnail: str | None = None
    published_date: str | None = None
    category: str | None = None
    engine: str | None = None


class SearchResponse(BaseModel):
    query: str
    page: int
    page_size: int
    total_results: int
    results: list[SearchResultItem]
    provider: str
    suggestions: list[str] = []
    infoboxes: list[dict] = []


class ErrorResponse(BaseModel):
    detail: str
    error_code: str | None = None


class SuggestResponse(BaseModel):
    query: str
    suggestions: list[str]
    source: str


class BackendProbe(BaseModel):
    available: bool
    status: str = "unknown"
    response_time_ms: float | None = None
    error: str | None = None


class EngineProbe(BaseModel):
    health: BackendProbe
    index_docs: int | None = None
    index_segments: int | None = None


class SearxngProbe(BaseModel):
    health: BackendProbe


class CrawlerProbe(BaseModel):
    available: bool
    status: str = "not_running"
    last_run: dict | None = None


class ServerInfo(BaseModel):
    version: str
    environment: str
    python_version: str
    started_at: str
    uptime_seconds: float
    request_count: int
    default_search_provider: str
    searxng_enabled: bool
    engine_base_url: str
    searxng_base_url: str
    crawler_enabled: bool
    cors_origins: list[str]


class SystemStats(BaseModel):
    server: ServerInfo
    engine: EngineProbe
    searxng: SearxngProbe
    crawler: CrawlerProbe
    timestamp: str


class SummarizeRequest(BaseModel):
    url: str


class SummarizeResponse(BaseModel):
    url: str
    title: str | None = None
    summary: str
    provider: str
    model: str


class WorkspaceCreateRequest(BaseModel):
    name: str
    description: str | None = None


class WorkspaceUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    item_count: int = 0
    created_at: datetime
    updated_at: datetime


class WorkspaceItemCreateRequest(BaseModel):
    url: str
    media_url: str | None = None
    title: str | None = None
    snippet: str | None = None
    source: str | None = None


class WorkspaceItemUpdateRequest(BaseModel):
    title: str | None = None
    snippet: str | None = None
    notes: str | None = None
    order_index: int | None = None


class WorkspaceItemResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    url: str
    media_url: str | None = None
    title: str | None = None
    snippet: str | None = None
    source: str | None = None
    summary: str | None = None
    notes: str | None = None
    order_index: int = 0
    created_at: datetime


class ItemSummaryResponse(BaseModel):
    item_id: UUID
    summary: str
    provider: str
    model: str


class ChatSource(BaseModel):
    url: str
    title: str | None = None


class ChatRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource]


class LLMGenerateRequest(BaseModel):
    query: str
    results: list[SearchResultItem] = []
    mode: str = "short"


class LLMGenerateResponse(BaseModel):
    response: str


class ReaderResponse(BaseModel):
    url: str
    title: str | None = None
    content: str
    content_length_chars: int = 0
    reading_time_seconds: int = 0
    success: bool = True
    error: str | None = None
    content_type: str = "article"
    media_url: str | None = None


# ── Profile ─────────────────────────────────────────────────────────────


class ProfileResponse(BaseModel):
    session_id: str
    username: str | None = None
    theme: str = "light"
    search_provider: str | None = None
    created_at: datetime
    last_active: datetime


class ProfileUpdateRequest(BaseModel):
    username: str | None = None
    theme: str | None = None
    search_provider: str | None = None


# ── History ─────────────────────────────────────────────────────────────


class SearchHistoryItem(BaseModel):
    id: UUID
    query: str
    provider: str | None = None
    searched_at: datetime


class ReadingListEntry(BaseModel):
    id: UUID
    title: str | None = None
    url: str
    source: str | None = None
    content: str | None = None
    content_type: str | None = None
    media_url: str | None = None
    saved_at: datetime


class SummaryListEntry(BaseModel):
    id: UUID
    title: str | None = None
    url: str
    source: str | None = None
    summary: str | None = None
    model: str | None = None
    saved_at: datetime


class ActivityLogItem(BaseModel):
    id: UUID
    action_type: str
    details: dict | None = None
    created_at: datetime


class OverviewResponse(BaseModel):
    query: str
    overview: str
    created_at: datetime
