import logging
import time
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from server.src.api import register_routes
from server.src.core.config import settings
from server.src.core.logging import setup_logging
from server.src.services.search_orch import SearchOrchestrator

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.log_level)
    now = datetime.now(timezone.utc)
    app.state.server_start = now
    app.state.request_count = 0
    app.state.orchestrator = SearchOrchestrator()

    logger.info(
        "Starting QWRY server",
        extra={
            "environment": settings.environment,
            "host": settings.host,
            "port": settings.port,
        },
    )
    yield
    await app.state.orchestrator.aclose()
    elapsed = (datetime.now(timezone.utc) - now).total_seconds()
    logger.info(
        "Shutting down QWRY server",
        extra={"uptime_seconds": round(elapsed, 2), "requests": app.state.request_count},
    )


app = FastAPI(
    title="QWRY Search Engine",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def count_requests(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    t0 = time.monotonic()
    response = await call_next(request)
    elapsed = (time.monotonic() - t0) * 1000
    app = request.app
    app.state.request_count += 1
    if request.url.path not in ("/api/health", "/favicon.ico"):
        extra = {
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "ms": round(elapsed, 1),
            "total_requests": app.state.request_count,
        }
        if request.query_params:
            extra["query"] = str(request.query_params)
        logger.debug("Request handled", extra=extra)
    return response


register_routes(app)
