import logging
import sys
import time
from datetime import datetime, timezone

import httpx

from server.src.api.schemas import (
    BackendProbe,
    CrawlerProbe,
    EngineProbe,
    SearxngProbe,
    ServerInfo,
    SystemStats,
)
from server.src.core.config import settings

logger = logging.getLogger(__name__)


class StatsCollector:
    def __init__(self, http_client: httpx.AsyncClient, request_count: int, server_start: datetime) -> None:
        self._http = http_client
        self._request_count = request_count
        self._server_start = server_start

    async def collect(self) -> SystemStats:
        engine_probe = await self._probe_engine()
        searxng_probe = await self._probe_searxng()
        crawler_probe = self._probe_crawler()

        return SystemStats(
            server=self._server_info(),
            engine=engine_probe,
            searxng=searxng_probe,
            crawler=crawler_probe,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    # ── Server ────────────────────────────────────────────────────────

    def _server_info(self) -> ServerInfo:
        now = datetime.now(timezone.utc)
        uptime = (now - self._server_start).total_seconds()

        return ServerInfo(
            version="0.1.0",
            environment=settings.environment,
            python_version=sys.version.split()[0],
            started_at=self._server_start.isoformat(),
            uptime_seconds=round(uptime, 2),
            request_count=self._request_count,
            default_search_provider=settings.default_search_provider,
            searxng_enabled=settings.searxng_enabled,
            engine_base_url=settings.engine_base_url,
            searxng_base_url=settings.searxng_base_url,
            crawler_enabled=settings.crawler_enabled,
            cors_origins=settings.cors_origins_list,
        )

    # ── Engine ────────────────────────────────────────────────────────

    async def _probe_engine(self) -> EngineProbe:
        base = settings.engine_base_url.rstrip("/")

        health, health_time = await self._check(f"{base}/health")
        if not health:
            return EngineProbe(health=BackendProbe(available=False, status="unreachable"))

        index_docs = None
        index_segments = None
        try:
            t0 = time.monotonic()
            resp = await self._http.get(
                f"{base}/search",
                params={"q": "the", "limit": 1, "offset": 0},
                timeout=settings.engine_timeout_seconds,
            )
            elapsed = (time.monotonic() - t0) * 1000
            if resp.is_success:
                data = resp.json()
                index_docs = data.get("total_hits")
        except Exception as e:
            logger.debug("Engine search probe failed", extra={"error": str(e)})

        index_segments = await self._probe_engine_segments(base)

        return EngineProbe(
            health=BackendProbe(
                available=True,
                status="healthy",
                response_time_ms=round(health_time, 2),
            ),
            index_docs=index_docs,
            index_segments=index_segments,
        )

    async def _probe_engine_segments(self, base: str) -> int | None:
        try:
            resp = await self._http.get(
                f"{base}/search",
                params={"q": "a", "limit": 0, "offset": 0},
                timeout=settings.engine_timeout_seconds,
            )
            if resp.is_success:
                data = resp.json()
                return data.get("total_hits")
        except Exception:
            pass
        return None

    # ── SearXNG ───────────────────────────────────────────────────────

    async def _probe_searxng(self) -> SearxngProbe:
        if not settings.searxng_enabled:
            return SearxngProbe(health=BackendProbe(available=False, status="disabled"))

        base = settings.searxng_base_url.rstrip("/")
        health, health_time = await self._check(f"{base}/healthz")

        if health:
            return SearxngProbe(
                health=BackendProbe(
                    available=True,
                    status="healthy",
                    response_time_ms=round(health_time, 2),
                ),
            )

        health, health_time = await self._check(f"{base}/search?format=json&q=ping")
        if health:
            return SearxngProbe(
                health=BackendProbe(
                    available=True,
                    status="healthy",
                    response_time_ms=round(health_time, 2),
                ),
            )

        return SearxngProbe(health=BackendProbe(available=False, status="unreachable"))

    # ── Crawler ───────────────────────────────────────────────────────

    def _probe_crawler(self) -> CrawlerProbe:
        if not settings.crawler_enabled:
            return CrawlerProbe(available=False, status="disabled")

        return CrawlerProbe(
            available=True,
            status="idle",
            last_run=None,
        )

    # ── Helpers ───────────────────────────────────────────────────────

    async def _check(self, url: str) -> tuple[bool, float]:
        t0 = time.monotonic()
        try:
            resp = await self._http.get(url, timeout=3.0)
            elapsed = (time.monotonic() - t0) * 1000
            return resp.is_success, elapsed
        except Exception as e:
            elapsed = (time.monotonic() - t0) * 1000
            logger.debug("Health probe failed", extra={"url": url, "error": str(e)})
            return False, elapsed
