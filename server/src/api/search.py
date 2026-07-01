import logging

from fastapi import APIRouter, Query

from server.src.api.schemas import SearchResponse, SearchResultItem

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Results per page"),
    provider: str | None = Query(None, description="Search provider override"),
):
    logger.info("Search request", extra={"query": q, "page": page, "page_size": page_size, "provider": provider})

    results = [
        SearchResultItem(
            title="Placeholder Result",
            url="https://example.com",
            snippet="This is a placeholder result. Search functionality is not yet connected.",
            source="stub",
        )
    ]

    return SearchResponse(
        query=q,
        page=page,
        page_size=page_size,
        total_results=1,
        results=results,
        provider=provider or "stub",
    )
