import logging
import time
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from server.src.api import register_routes
from server.src.core.config import settings
from server.src.core.logging import setup_logging
from server.src.core.registry import EndpointRegistry
from server.src.db import close_db, init_db
from server.src.services.cache import CacheService
from server.src.services.llm import OllamaBackend
from server.src.services.reader import ReaderService
from server.src.services.search_orch import SearchOrchestrator
from server.src.services.summarizer import Summarizer

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.log_level)
    now = datetime.now(UTC)

    async with httpx.AsyncClient() as http_client:
        app.state.server_start = now
        app.state.request_count = 0
        app.state.http = http_client
        app.state.registry = EndpointRegistry()
        app.state.cache = CacheService()
        await app.state.cache.connect()
        app.state.orchestrator = SearchOrchestrator(http_client, app.state.registry, app.state.cache)

        if settings.summary_provider == "ollama":
            llm = OllamaBackend(
                http_client,
                settings.ollama_base_url,
                settings.summary_model,
                settings.summary_timeout_seconds,
            )
        else:
            raise ValueError(f"Unknown summary_provider: {settings.summary_provider}")
        app.state.summarizer = Summarizer(llm, http_client, settings.summary_max_content_length, app.state.cache)
        app.state.reader = ReaderService(http_client, app.state.cache)

        await init_db(settings.database_url)
        from server.src.db import async_session_maker

        app.state.db = async_session_maker

        logger.info(
            "Starting QWRY server",
            extra={
                "environment": settings.environment,
                "host": settings.host,
                "port": settings.port,
            },
        )
        yield

    elapsed = (datetime.now(UTC) - now).total_seconds()
    await app.state.cache.close()
    await close_db()
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
