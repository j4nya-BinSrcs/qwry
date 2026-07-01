from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

from server.src.services.runner import Task
from server.test.conftest import get_client


def make_task(task_id: str, status: str = "running") -> Task:
    return Task(
        id=task_id,
        command="crawler --seeds https://example.com",
        status=status,
        started_at=datetime.now(UTC),
    )


class TestCrawl:
    def test_crawl_returns_task_id(self, monkeypatch):
        mock = AsyncMock(return_value=make_task("abc123"))
        monkeypatch.setattr("server.src.services.runner.TaskManager.run_crawl", mock)

        client = next(get_client())
        resp = client.post("/api/crawl", json={"seeds": ["https://a.com"], "max_depth": 1, "max_pages": 5})
        assert resp.status_code == 202
        data = resp.json()
        assert data["task_id"] == "abc123"
        assert data["status"] == "started"

    def test_crawl_missing_seeds(self):
        client = next(get_client())
        resp = client.post("/api/crawl", json={})
        assert resp.status_code == 422

    def test_crawl_empty_seeds(self, monkeypatch):
        mock = AsyncMock(return_value=make_task("empty001"))
        monkeypatch.setattr("server.src.services.runner.TaskManager.run_crawl", mock)

        client = next(get_client())
        resp = client.post("/api/crawl", json={"seeds": []})
        assert resp.status_code == 202

    def test_crawl_no_body(self):
        client = next(get_client())
        resp = client.post("/api/crawl")
        assert resp.status_code == 422


class TestCrawlStatus:
    def test_get_existing_task(self, monkeypatch):
        task = make_task("task456")
        mock = MagicMock(return_value=task)
        monkeypatch.setattr("server.src.services.runner.TaskManager.get", mock)

        client = next(get_client())
        resp = client.get("/api/crawl/task456")
        assert resp.status_code == 200
        assert resp.json()["task_id"] == "task456"
        assert resp.json()["status"] == "running"

    def test_get_missing_task(self, monkeypatch):
        mock = MagicMock(return_value=None)
        monkeypatch.setattr("server.src.services.runner.TaskManager.get", mock)

        client = next(get_client())
        resp = client.get("/api/crawl/nonexistent")
        assert resp.status_code == 200
        assert resp.json()["status"] == "not_found"


class TestReindex:
    def test_reindex_returns_task_id(self, monkeypatch):
        mock = AsyncMock(return_value=make_task("reidx001"))
        monkeypatch.setattr("server.src.services.runner.TaskManager.run_reindex", mock)

        client = next(get_client())
        resp = client.post("/api/reindex", json={})
        assert resp.status_code == 202
        data = resp.json()
        assert data["task_id"] == "reidx001"
        assert data["status"] == "started"

    def test_reindex_no_body(self, monkeypatch):
        mock = AsyncMock(return_value=make_task("reidx002"))
        monkeypatch.setattr("server.src.services.runner.TaskManager.run_reindex", mock)

        client = next(get_client())
        resp = client.post("/api/reindex")
        assert resp.status_code == 202
