from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SearchResultItem(BaseModel):
    title: str
    url: str
    snippet: str
    source: str


class SearchResponse(BaseModel):
    query: str
    page: int
    page_size: int
    total_results: int
    results: list[SearchResultItem]
    provider: str


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
    title: str | None = None
    snippet: str | None = None
    source: str | None = None


class WorkspaceItemUpdateRequest(BaseModel):
    title: str | None = None
    snippet: str | None = None
    notes: str | None = None


class WorkspaceItemResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    url: str
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
