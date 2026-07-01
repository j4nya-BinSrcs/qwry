from pydantic import BaseModel

# ── Search ────────────────────────────────────────────────────────────


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


# ── Crawl ─────────────────────────────────────────────────────────────


class CrawlRequest(BaseModel):
    seeds: list[str]
    max_depth: int = 3
    max_pages: int = 100
    external_domains: bool = False


class TaskResponse(BaseModel):
    task_id: str
    status: str
    message: str


# ── Reindex ───────────────────────────────────────────────────────────


class ReindexRequest(BaseModel):
    max_pages: int | None = None


# ── Suggest ───────────────────────────────────────────────────────────


class SuggestResponse(BaseModel):
    query: str
    suggestions: list[str]
    source: str


# ── Stats ─────────────────────────────────────────────────────────────


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
