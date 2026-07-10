from fastapi import APIRouter, FastAPI
from server.src.api.endpoints import (
    health,
    image_proxy,
    item_create,
    item_delete,
    item_list,
    item_summarize,
    item_update,
    read_url,
    search,
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
    ChatResponse,
    ItemSummaryResponse,
    ReaderResponse,
    SearchResponse,
    SuggestResponse,
    SummarizeResponse,
    SystemStats,
    WorkspaceItemResponse,
    WorkspaceResponse,
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


def register_routes(app: FastAPI) -> None:
    app.include_router(health_router)
    app.include_router(search_router)
    app.include_router(stats_router)
    app.include_router(suggest_router)
    app.include_router(image_router)
    app.include_router(reader_router)
    app.include_router(summarize_router)
    app.include_router(workspace_router)
    app.include_router(item_router)
