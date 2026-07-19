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


# ── Workspace Station ─────────────────────────────────────────────────────


class WorkspaceReadCreate(BaseModel):
    item_id: UUID
    status: str = "unread"


class WorkspaceReadUpdate(BaseModel):
    status: str


class WorkspaceReadResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    item_id: UUID
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class WorkspaceHighlightCreate(BaseModel):
    item_id: UUID
    text: str
    color: str | None = None
    note: str | None = None
    page_url: str | None = None


class WorkspaceHighlightResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    item_id: UUID
    text: str
    color: str | None = None
    note: str | None = None
    page_url: str | None = None
    created_at: datetime


class WorkspaceNoteCreate(BaseModel):
    title: str
    content: str = ""


class WorkspaceNoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


class WorkspaceNoteResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    content: str
    created_at: datetime
    updated_at: datetime


class WorkspacePinCreate(BaseModel):
    pinnable_type: str
    pinnable_id: UUID


class WorkspacePinReorder(BaseModel):
    pin_ids: list[UUID]


class WorkspacePinResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    pinnable_type: str
    pinnable_id: UUID
    order_index: int
    created_at: datetime


class WorkspaceImageCreate(BaseModel):
    item_id: UUID | None = None
    url: str
    caption: str | None = None
    resolution_w: int | None = None
    resolution_h: int | None = None
    license: str | None = None


class WorkspaceImageResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    item_id: UUID | None = None
    url: str
    caption: str | None = None
    resolution_w: int | None = None
    resolution_h: int | None = None
    license: str | None = None
    created_at: datetime


class WorkspaceVideoUpdate(BaseModel):
    title: str | None = None
    thumbnail: str | None = None
    duration_secs: int | None = None
    creator: str | None = None
    platform: str | None = None
    transcript: str | None = None
    summary: str | None = None


class WorkspaceVideoCreate(BaseModel):
    item_id: UUID | None = None
    url: str
    title: str | None = None
    thumbnail: str | None = None
    duration_secs: int | None = None
    creator: str | None = None
    platform: str | None = None
    transcript: str | None = None
    summary: str | None = None


class WorkspaceVideoResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    item_id: UUID | None = None
    url: str
    title: str | None = None
    thumbnail: str | None = None
    duration_secs: int | None = None
    creator: str | None = None
    platform: str | None = None
    transcript: str | None = None
    summary: str | None = None
    created_at: datetime


class WorkspaceComparisonCreate(BaseModel):
    title: str
    data: dict | None = None


class WorkspaceComparisonUpdate(BaseModel):
    title: str | None = None
    data: dict | None = None


class WorkspaceComparisonResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    data: dict | None = None
    created_at: datetime
    updated_at: datetime


class WorkspaceTimelineEventResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    action_type: str
    object_type: str
    object_id: UUID
    event_metadata: dict | None = None
    created_at: datetime


class WorkspaceTagCreate(BaseModel):
    name: str
    color: str | None = None


class WorkspaceTagAssign(BaseModel):
    object_type: str
    object_id: UUID


class WorkspaceTagResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    color: str | None = None
    created_at: datetime


class WorkspaceStatsResponse(BaseModel):
    sources: int = 0
    reads: int = 0
    summaries: int = 0
    notes: int = 0
    pins: int = 0
    images: int = 0
    videos: int = 0
    comparisons: int = 0
    highlights: int = 0
    tags: int = 0


class WorkspaceSearchQuery(BaseModel):
    q: str


class WorkspaceSearchResult(BaseModel):
    object_type: str
    object_id: UUID
    title: str
    snippet: str | None = None
    url: str | None = None


# ── Canvas ─────────────────────────────────────────────────────────────────


class CanvasNodeCreate(BaseModel):
    object_type: str
    object_id: UUID
    x: float = 0.0
    y: float = 0.0
    width: float | None = None
    height: float | None = None
    z_index: int = 0
    pinned: bool = False
    label: str | None = None
    color: str | None = None


class CanvasNodeUpdate(BaseModel):
    x: float | None = None
    y: float | None = None
    width: float | None = None
    height: float | None = None
    z_index: int | None = None
    pinned: bool | None = None
    label: str | None = None
    color: str | None = None


class CanvasNodeResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    object_type: str
    object_id: UUID
    x: float = 0.0
    y: float = 0.0
    width: float | None = None
    height: float | None = None
    z_index: int = 0
    pinned: bool = False
    label: str | None = None
    color: str | None = None
    created_at: datetime
    updated_at: datetime


class CanvasConnectionCreate(BaseModel):
    source_node_id: UUID
    target_node_id: UUID
    label: str | None = None
    style: str = "solid"
    color: str | None = None


class CanvasConnectionResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    source_node_id: UUID
    target_node_id: UUID
    label: str | None = None
    style: str = "solid"
    color: str | None = None
    created_at: datetime


# ── AI Responses ───────────────────────────────────────────────────────────


class WorkspaceAIResponseCreate(BaseModel):
    title: str
    prompt: str = ""
    response_text: str = ""
    model: str | None = None
    provider: str | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None


class WorkspaceAIResponseUpdate(BaseModel):
    title: str | None = None
    prompt: str | None = None
    response_text: str | None = None
    model: str | None = None
    provider: str | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None


class WorkspaceAIResponseResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    prompt: str
    response_text: str
    model: str | None = None
    provider: str | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None
    created_at: datetime
    updated_at: datetime


# ── Tasks ──────────────────────────────────────────────────────────────────


class WorkspaceTaskCreate(BaseModel):
    title: str
    description: str | None = None
    status: str = "pending"
    priority: str = "medium"
    due_date: datetime | None = None
    assignee: str | None = None


class WorkspaceTaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    due_date: datetime | None = None
    assignee: str | None = None


class WorkspaceTaskResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    description: str | None = None
    status: str = "pending"
    priority: str = "medium"
    due_date: datetime | None = None
    assignee: str | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
