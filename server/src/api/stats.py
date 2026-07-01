import logging

from fastapi import APIRouter, Request

from server.src.api.schemas import SystemStats
from server.src.services.stats_service import StatsCollector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/stats", response_model=SystemStats)
async def system_stats(request: Request) -> SystemStats:
    collector = StatsCollector(
        http_client=request.app.state.http,
        registry=request.app.state.registry,
        request_count=request.app.state.request_count,
        server_start=request.app.state.server_start,
    )
    return await collector.collect()
