import logging

from fastapi import APIRouter, Request
from server.src.api.schemas import CrawlRequest, TaskResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["crawl"])


@router.post("/crawl", status_code=202, response_model=TaskResponse)
async def start_crawl(request: Request, body: CrawlRequest) -> TaskResponse:
    runner = request.app.state.task_runner
    logger.info(
        "Crawl request",
        extra={"seeds": body.seeds, "max_depth": body.max_depth, "max_pages": body.max_pages},
    )
    task = await runner.run_crawl(
        seeds=body.seeds,
        max_depth=body.max_depth,
        max_pages=body.max_pages,
        external_domains=body.external_domains,
    )
    if task.status == "failed":
        return TaskResponse(task_id=task.id, status="failed", message=task.error or "Unknown error")
    return TaskResponse(
        task_id=task.id,
        status="started",
        message=f"Crawling {len(body.seeds)} seed(s) with max_depth={body.max_depth}, max_pages={body.max_pages}",
    )


@router.get("/crawl/{task_id}", response_model=TaskResponse)
async def crawl_status(request: Request, task_id: str) -> TaskResponse:
    runner = request.app.state.task_runner
    task = runner.get(task_id)
    if not task:
        return TaskResponse(task_id=task_id, status="not_found", message="No such task")
    return TaskResponse(
        task_id=task.id,
        status=task.status,
        message=task.error or f"Return code: {task.return_code}" if task.return_code is not None else "In progress",
    )
