from unittest.mock import AsyncMock

from server.src.api.schemas import SearchResponse, SearchResultItem
from server.src.services.search_orch import SearchOrchestrator


def make_search_response(query: str, provider: str = "searxng") -> SearchResponse:
    return SearchResponse(
        query=query,
        page=1,
        page_size=10,
        total_results=2,
        results=[
            SearchResultItem(title="Result A", url="https://a.com", snippet="Snippet A", source=provider),
            SearchResultItem(title="Result B", url="https://b.com", snippet="Snippet B", source=provider),
        ],
        provider=provider,
    )


def test_search_default_provider(monkeypatch, client):
    mock = AsyncMock(return_value=make_search_response("hello"))
    monkeypatch.setattr(SearchOrchestrator, "search", mock)

    resp = client.get("/api/search", params={"q": "hello"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["query"] == "hello"
    assert len(data["results"]) == 2
    assert data["total_results"] == 2


def test_search_engine_provider(monkeypatch, client):
    mock = AsyncMock(return_value=make_search_response("hello", provider="engine"))
    monkeypatch.setattr(SearchOrchestrator, "search", mock)

    resp = client.get("/api/search", params={"q": "hello", "provider": "engine"})
    assert resp.status_code == 200
    assert resp.json()["provider"] == "engine"


def test_search_empty_query(client):
    resp = client.get("/api/search")
    assert resp.status_code == 422


def test_search_invalid_page_size(client):
    resp = client.get("/api/search", params={"q": "hello", "page_size": 999})
    assert resp.status_code == 422


def test_search_pagination(monkeypatch, client):
    mock = AsyncMock(return_value=make_search_response("hello"))
    monkeypatch.setattr(SearchOrchestrator, "search", mock)

    resp = client.get("/api/search", params={"q": "hello", "page": 2, "page_size": 5, "provider": "engine"})
    assert resp.status_code == 200
    mock.assert_called_once()
    args, kwargs = mock.call_args
    q, page, page_size, provider = args
    assert q == "hello"
    assert page == 2
    assert page_size == 5
    assert provider == "engine"
