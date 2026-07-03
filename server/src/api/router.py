from fastapi import APIRouter, FastAPI
from server.src.api.endpoints import health, search, suggest, summarize, system_stats
from server.src.api.schemas import SearchResponse, SuggestResponse, SummarizeResponse, SystemStats

health_router = APIRouter(tags=["health"])
health_router.add_api_route("/api/health", health, methods=["GET"])

search_router = APIRouter(prefix="/api", tags=["search"])
search_router.add_api_route("/search", search, methods=["GET"], response_model=SearchResponse)

stats_router = APIRouter(prefix="/api", tags=["stats"])
stats_router.add_api_route("/stats", system_stats, methods=["GET"], response_model=SystemStats)

suggest_router = APIRouter(prefix="/api", tags=["suggest"])
suggest_router.add_api_route("/suggest", suggest, methods=["GET"], response_model=SuggestResponse)

summarize_router = APIRouter(prefix="/api", tags=["summarize"])
summarize_router.add_api_route(
    "/summarize",
    summarize,
    methods=["POST"],
    response_model=SummarizeResponse,
)


def register_routes(app: FastAPI) -> None:
    app.include_router(health_router)
    app.include_router(search_router)
    app.include_router(stats_router)
    app.include_router(suggest_router)
    app.include_router(summarize_router)
