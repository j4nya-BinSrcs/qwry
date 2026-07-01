import logging

from fastapi import APIRouter, Query, Request
from server.src.api.schemas import SearchResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search", response_model=SearchResponse)
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
