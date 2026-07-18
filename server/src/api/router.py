from fastapi import APIRouter, FastAPI
from server.src.api.endpoints import (
    health,
    history_activity,
    history_reads,
    history_search,
    history_summaries,
    image_proxy,
    item_create,
    item_delete,
    item_list,
    item_summarize,
    item_update,
    llm_generate,
    overview_get,
    profile_get,
    profile_update,
    read_url,
    search,
    station_comparisons_create,
    station_comparisons_delete,
    station_comparisons_list,
    station_comparisons_update,
    station_highlights_create,
    station_highlights_delete,
    station_highlights_list,
    station_images_create,
    station_images_delete,
    station_images_list,
    station_load_all,
    station_notes_create,
    station_notes_delete,
    station_notes_list,
    station_notes_update,
    station_pins_create,
    station_pins_delete,
    station_pins_list,
    station_pins_reorder,
    station_reads_create,
    station_reads_delete,
    station_reads_list,
    station_reads_update,
    station_search,
    station_stats,
    station_tags_assign,
    station_tags_create,
    station_tags_delete,
    station_tags_list,
    station_tags_objects,
    station_tags_unassign,
    station_timeline_list,
    station_videos_create,
    station_videos_delete,
    station_videos_list,
    station_videos_update,
    suggest,
    summarize,
    system_stats,
    workspace_chat,
    workspace_create,
    workspace_delete,
    workspace_get,
    workspace_list,
    workspace_update,
)
from server.src.api.schemas import (
    ActivityLogItem,
    ChatResponse,
    ItemSummaryResponse,
    LLMGenerateResponse,
    OverviewResponse,
    ProfileResponse,
    ReaderResponse,
    ReadingListEntry,
    SearchHistoryItem,
    SearchResponse,
    SuggestResponse,
    SummarizeResponse,
    SummaryListEntry,
    SystemStats,
    WorkspaceComparisonResponse,
    WorkspaceHighlightResponse,
    WorkspaceImageResponse,
    WorkspaceItemResponse,
    WorkspaceNoteResponse,
    WorkspacePinResponse,
    WorkspaceReadResponse,
    WorkspaceResponse,
    WorkspaceSearchResult,
    WorkspaceStatsResponse,
    WorkspaceTagResponse,
    WorkspaceTimelineEventResponse,
    WorkspaceVideoResponse,
)

health_router = APIRouter(tags=["health"])
health_router.add_api_route("/api/health", health, methods=["GET"])

search_router = APIRouter(prefix="/api", tags=["search"])
search_router.add_api_route("/search", search, methods=["GET"], status_code=200, response_model=SearchResponse)

stats_router = APIRouter(prefix="/api", tags=["stats"])
stats_router.add_api_route("/stats", system_stats, methods=["GET"], response_model=SystemStats)

image_router = APIRouter(prefix="/api", tags=["image"])
image_router.add_api_route("/image-proxy", image_proxy, methods=["GET"])

suggest_router = APIRouter(prefix="/api", tags=["suggest"])
suggest_router.add_api_route("/suggest", suggest, methods=["GET"], response_model=SuggestResponse)

llm_router = APIRouter(prefix="/api/llm", tags=["llm"])
llm_router.add_api_route(
    "/generate",
    llm_generate,
    methods=["POST"],
    response_model=LLMGenerateResponse,
)

reader_router = APIRouter(prefix="/api", tags=["reader"])
reader_router.add_api_route("/read", read_url, methods=["GET"], response_model=ReaderResponse)

summarize_router = APIRouter(prefix="/api", tags=["summarize"])
summarize_router.add_api_route(
    "/summarize",
    summarize,
    methods=["POST"],
    response_model=SummarizeResponse,
)

workspace_router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])
workspace_router.add_api_route("", workspace_list, methods=["GET"], response_model=list[WorkspaceResponse])
workspace_router.add_api_route(
    "",
    workspace_create,
    methods=["POST"],
    response_model=WorkspaceResponse,
    status_code=201,
)
workspace_router.add_api_route("/{ws_id}", workspace_get, methods=["GET"], response_model=WorkspaceResponse)
workspace_router.add_api_route("/{ws_id}", workspace_update, methods=["PATCH"], response_model=WorkspaceResponse)
workspace_router.add_api_route("/{ws_id}", workspace_delete, methods=["DELETE"])
workspace_router.add_api_route("/{ws_id}/items", item_list, methods=["GET"], response_model=list[WorkspaceItemResponse])
workspace_router.add_api_route(
    "/{ws_id}/items",
    item_create,
    methods=["POST"],
    response_model=WorkspaceItemResponse,
    status_code=201,
)
workspace_router.add_api_route("/{ws_id}/chat", workspace_chat, methods=["POST"], response_model=ChatResponse)

item_router = APIRouter(prefix="/api/workspaces/items", tags=["workspaces"])
item_router.add_api_route("/{item_id}", item_update, methods=["PATCH"], response_model=WorkspaceItemResponse)
item_router.add_api_route("/{item_id}", item_delete, methods=["DELETE"])
item_router.add_api_route("/{item_id}/summarize", item_summarize, methods=["POST"], response_model=ItemSummaryResponse)


profile_router = APIRouter(prefix="/api", tags=["profile"])
profile_router.add_api_route("/profile", profile_get, methods=["GET"], response_model=ProfileResponse)
profile_router.add_api_route("/profile", profile_update, methods=["PUT"], response_model=ProfileResponse)

history_router = APIRouter(prefix="/api/history", tags=["history"])
history_router.add_api_route("/search", history_search, methods=["GET"], response_model=list[SearchHistoryItem])
history_router.add_api_route("/reads", history_reads, methods=["GET"], response_model=list[ReadingListEntry])
history_router.add_api_route("/summaries", history_summaries, methods=["GET"], response_model=list[SummaryListEntry])
history_router.add_api_route("/activity", history_activity, methods=["GET"], response_model=list[ActivityLogItem])
history_router.add_api_route("/overviews", overview_get, methods=["GET"], response_model=OverviewResponse | None)


# ── Workspace Station Router ─────────────────────────────────────────────


station_router = APIRouter(prefix="/api/workspaces/{ws_id}/station", tags=["workspace-station"])

station_router.add_api_route("/reads", station_reads_list, methods=["GET"], response_model=list[WorkspaceReadResponse])
station_router.add_api_route("/reads", station_reads_create, methods=["POST"], response_model=WorkspaceReadResponse, status_code=201)
station_router.add_api_route("/reads/{entry_id}", station_reads_update, methods=["PATCH"], response_model=WorkspaceReadResponse)
station_router.add_api_route("/reads/{entry_id}", station_reads_delete, methods=["DELETE"])

station_router.add_api_route("/highlights", station_highlights_list, methods=["GET"], response_model=list[WorkspaceHighlightResponse])
station_router.add_api_route("/highlights", station_highlights_create, methods=["POST"], response_model=WorkspaceHighlightResponse, status_code=201)
station_router.add_api_route("/highlights/{entry_id}", station_highlights_delete, methods=["DELETE"])

station_router.add_api_route("/notes", station_notes_list, methods=["GET"], response_model=list[WorkspaceNoteResponse])
station_router.add_api_route("/notes", station_notes_create, methods=["POST"], response_model=WorkspaceNoteResponse, status_code=201)
station_router.add_api_route("/notes/{entry_id}", station_notes_update, methods=["PATCH"], response_model=WorkspaceNoteResponse)
station_router.add_api_route("/notes/{entry_id}", station_notes_delete, methods=["DELETE"])

station_router.add_api_route("/pins", station_pins_list, methods=["GET"], response_model=list[WorkspacePinResponse])
station_router.add_api_route("/pins", station_pins_create, methods=["POST"], response_model=WorkspacePinResponse, status_code=201)
station_router.add_api_route("/pins/reorder", station_pins_reorder, methods=["PUT"], response_model=list[WorkspacePinResponse])
station_router.add_api_route("/pins/{entry_id}", station_pins_delete, methods=["DELETE"])

station_router.add_api_route("/images", station_images_list, methods=["GET"], response_model=list[WorkspaceImageResponse])
station_router.add_api_route("/images", station_images_create, methods=["POST"], response_model=WorkspaceImageResponse, status_code=201)
station_router.add_api_route("/images/{entry_id}", station_images_delete, methods=["DELETE"])

station_router.add_api_route("/videos", station_videos_list, methods=["GET"], response_model=list[WorkspaceVideoResponse])
station_router.add_api_route("/videos", station_videos_create, methods=["POST"], response_model=WorkspaceVideoResponse, status_code=201)
station_router.add_api_route("/videos/{entry_id}", station_videos_update, methods=["PATCH"], response_model=WorkspaceVideoResponse)
station_router.add_api_route("/videos/{entry_id}", station_videos_delete, methods=["DELETE"])

station_router.add_api_route("/comparisons", station_comparisons_list, methods=["GET"], response_model=list[WorkspaceComparisonResponse])
station_router.add_api_route("/comparisons", station_comparisons_create, methods=["POST"], response_model=WorkspaceComparisonResponse, status_code=201)
station_router.add_api_route("/comparisons/{entry_id}", station_comparisons_update, methods=["PATCH"], response_model=WorkspaceComparisonResponse)
station_router.add_api_route("/comparisons/{entry_id}", station_comparisons_delete, methods=["DELETE"])

station_router.add_api_route("/timeline", station_timeline_list, methods=["GET"], response_model=list[WorkspaceTimelineEventResponse])

station_router.add_api_route("/tags", station_tags_list, methods=["GET"], response_model=list[WorkspaceTagResponse])
station_router.add_api_route("/tags", station_tags_create, methods=["POST"], response_model=WorkspaceTagResponse, status_code=201)
station_router.add_api_route("/tags/{entry_id}", station_tags_delete, methods=["DELETE"])
station_router.add_api_route("/tags/{tag_id}/assign", station_tags_assign, methods=["POST"])
station_router.add_api_route("/tags/{tag_id}/unassign", station_tags_unassign, methods=["POST"])
station_router.add_api_route("/tags/{tag_id}/objects", station_tags_objects, methods=["GET"], response_model=list[WorkspaceSearchResult])

station_router.add_api_route("/stats", station_stats, methods=["GET"], response_model=WorkspaceStatsResponse)
station_router.add_api_route("/search", station_search, methods=["GET"], response_model=list[WorkspaceSearchResult])
station_router.add_api_route("/load-all", station_load_all, methods=["GET"])


def register_routes(app: FastAPI) -> None:
    app.include_router(health_router)
    app.include_router(search_router)
    app.include_router(llm_router)
    app.include_router(stats_router)
    app.include_router(suggest_router)
    app.include_router(image_router)
    app.include_router(reader_router)
    app.include_router(summarize_router)
    app.include_router(workspace_router)
    app.include_router(item_router)
    app.include_router(profile_router)
    app.include_router(history_router)
    app.include_router(station_router)
