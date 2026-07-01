import logging

from fastapi import APIRouter, Request
from server.src.api.schemas import ReindexRequest, TaskResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["reindex"])


@router.post("/reindex", status_code=202, response_model=TaskResponse)
async def start_reindex(request: Request, body: ReindexRequest | None = None) -> TaskResponse:
    runner = request.app.state.task_runner
    logger.info("Reindex request")
    task = await runner.run_reindex(max_pages=body.max_pages if body else None)
    if task.status == "failed":
        return TaskResponse(task_id=task.id, status="failed", message=task.error or "Unknown error")
    return TaskResponse(
        task_id=task.id,
        status="started",
        message="Rebuilding Tantivy index from all crawled pages",
    )
