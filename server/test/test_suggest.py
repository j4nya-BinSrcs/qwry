from unittest.mock import AsyncMock

from server.src.api import endpoints


def test_suggest_returns_list(monkeypatch, client):
    mock = AsyncMock(return_value=(["python", "pytest", "pyramid"], "searxng_autocompleter"))
    monkeypatch.setattr(endpoints, "_try_searxng_autocompleter", mock)

    resp = client.get("/api/suggest", params={"q": "py"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["query"] == "py"
    assert len(data["suggestions"]) == 3
    assert data["source"] == "searxng_autocompleter"


def test_suggest_empty_suggestions(monkeypatch, client):
    mock_auto = AsyncMock(return_value=([], "none"))
    mock_search = AsyncMock(return_value=([], "none"))
    mock_engine = AsyncMock(return_value=(["engine title"], "engine"))
    monkeypatch.setattr(endpoints, "_try_searxng_autocompleter", mock_auto)
    monkeypatch.setattr(endpoints, "_try_searxng_search_suggestions", mock_search)
    monkeypatch.setattr(endpoints, "_try_engine_search_suggestions", mock_engine)

    resp = client.get("/api/suggest", params={"q": "test"})
    assert resp.status_code == 200
    assert resp.json()["source"] == "engine"
    assert resp.json()["suggestions"] == ["engine title"]


def test_suggest_no_results(monkeypatch, client):
    mock_auto = AsyncMock(return_value=([], "none"))
    mock_search = AsyncMock(return_value=([], "none"))
    mock_engine = AsyncMock(return_value=([], "none"))
    monkeypatch.setattr(endpoints, "_try_searxng_autocompleter", mock_auto)
    monkeypatch.setattr(endpoints, "_try_searxng_search_suggestions", mock_search)
    monkeypatch.setattr(endpoints, "_try_engine_search_suggestions", mock_engine)

    resp = client.get("/api/suggest", params={"q": "xyz"})
    assert resp.status_code == 200
    assert resp.json()["source"] == "none"
    assert resp.json()["suggestions"] == []


def test_suggest_empty_query(client):
    resp = client.get("/api/suggest")
    assert resp.status_code == 422
