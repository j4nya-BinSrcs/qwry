from datetime import UTC, datetime
from unittest.mock import AsyncMock

from server.src.api.schemas import (
    BackendProbe,
    CrawlerProbe,
    EngineProbe,
    SearxngProbe,
    ServerInfo,
    SystemStats,
)
from server.src.services.stats_service import StatsCollector


def make_stats():
    return SystemStats(
        server=ServerInfo(
            version="0.1.0",
            environment="test",
            python_version="3.13",
            started_at=datetime.now(UTC).isoformat(),
            uptime_seconds=12.34,
            request_count=5,
            default_search_provider="searxng",
            searxng_enabled=True,
            engine_base_url="http://127.0.0.1:8001",
            searxng_base_url="http://127.0.0.1:8080",
            crawler_enabled=True,
            cors_origins=["*"],
        ),
        engine=EngineProbe(
            health=BackendProbe(available=True, status="healthy", response_time_ms=2.5),
            index_docs=1251,
            index_segments=12,
        ),
        searxng=SearxngProbe(
            health=BackendProbe(available=True, status="healthy", response_time_ms=1.2),
        ),
        crawler=CrawlerProbe(available=True, status="idle", last_run=None),
        timestamp=datetime.now(UTC).isoformat(),
    )


def test_stats_structure(monkeypatch, client):
    mock = AsyncMock(return_value=make_stats())
    monkeypatch.setattr(StatsCollector, "collect", mock)

    resp = client.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["server"]["environment"] == "test"
    assert data["server"]["request_count"] == 5
    assert data["engine"]["health"]["status"] == "healthy"
    assert data["engine"]["index_docs"] == 1251
    assert data["engine"]["index_segments"] == 12
    assert data["searxng"]["health"]["available"] is True
    assert data["crawler"]["available"] is True


def test_stats_fields_present(monkeypatch, client):
    mock = AsyncMock(return_value=make_stats())
    monkeypatch.setattr(StatsCollector, "collect", mock)

    data = client.get("/api/stats").json()

    expected_top = {"server", "engine", "searxng", "crawler", "timestamp"}
    assert set(data) == expected_top, f"Missing keys: {expected_top - set(data)}"

    server_keys = {
        "version",
        "environment",
        "python_version",
        "started_at",
        "uptime_seconds",
        "request_count",
        "default_search_provider",
        "searxng_enabled",
        "engine_base_url",
        "searxng_base_url",
        "crawler_enabled",
        "cors_origins",
    }
    assert set(data["server"]) == server_keys, f"Missing server keys: {server_keys - set(data['server'])}"

    engine_keys = {"health", "index_docs", "index_segments"}
    assert set(data["engine"]) == engine_keys

    searxng_keys = {"health"}
    assert set(data["searxng"]) == searxng_keys

    health_keys = {"available", "status", "response_time_ms", "error"}
    assert set(data["engine"]["health"]) == health_keys
