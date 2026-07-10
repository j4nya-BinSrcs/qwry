from unittest.mock import AsyncMock

SESSION_ID = "test-session-123"
ANOTHER_SESSION = "other-session-456"


def _headers(sid: str | None = SESSION_ID) -> dict:
    return {"X-Session-Id": sid} if sid else {}


class TestWorkspaceCRUD:
    def test_create_workspace(self, client):
        resp = client.post("/api/workspaces", json={"name": "My Research"}, headers=_headers())
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Research"
        assert "id" in data

    def test_list_workspaces(self, client):
        client.post("/api/workspaces", json={"name": "WS One"}, headers=_headers())
        client.post("/api/workspaces", json={"name": "WS Two"}, headers=_headers())
        resp = client.get("/api/workspaces", headers=_headers())
        assert resp.status_code == 200
        names = [w["name"] for w in resp.json()]
        assert "WS One" in names
        assert "WS Two" in names

    def test_get_workspace(self, client):
        created = client.post("/api/workspaces", json={"name": "Get Me"}, headers=_headers()).json()
        resp = client.get(f"/api/workspaces/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        assert resp.json()["name"] == "Get Me"

    def test_get_workspace_not_found(self, client):
        resp = client.get("/api/workspaces/00000000-0000-0000-0000-000000000000", headers=_headers())
        assert resp.status_code == 404

    def test_update_workspace(self, client):
        created = client.post("/api/workspaces", json={"name": "Old Name"}, headers=_headers()).json()
        resp = client.patch(
            f"/api/workspaces/{created['id']}",
            json={"name": "New Name"},
            headers=_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"

    def test_delete_workspace(self, client):
        created = client.post("/api/workspaces", json={"name": "Delete Me"}, headers=_headers()).json()
        resp = client.delete(f"/api/workspaces/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"
        get_resp = client.get(f"/api/workspaces/{created['id']}", headers=_headers())
        assert get_resp.status_code == 404

    def test_session_isolation(self, client):
        client.post("/api/workspaces", json={"name": "Session A WS"}, headers=_headers(SESSION_ID))
        client.post("/api/workspaces", json={"name": "Session B WS"}, headers=_headers(ANOTHER_SESSION))
        list_a = client.get("/api/workspaces", headers=_headers(SESSION_ID)).json()
        list_b = client.get("/api/workspaces", headers=_headers(ANOTHER_SESSION)).json()
        names_a = {w["name"] for w in list_a}
        names_b = {w["name"] for w in list_b}
        assert "Session A WS" in names_a
        assert "Session B WS" not in names_a
        assert "Session B WS" in names_b
        assert "Session A WS" not in names_b

    def test_create_without_session_generates_one(self, client):
        resp = client.post("/api/workspaces", json={"name": "No Session"})
        assert resp.status_code == 201

    def test_create_workspace_with_description(self, client):
        resp = client.post(
            "/api/workspaces",
            json={"name": "Described", "description": "A description"},
            headers=_headers(),
        )
        assert resp.status_code == 201
        assert resp.json()["description"] == "A description"


class TestWorkspaceItems:
    def test_add_item(self, client):
        ws = client.post("/api/workspaces", json={"name": "Item WS"}, headers=_headers()).json()
        resp = client.post(
            f"/api/workspaces/{ws['id']}/items",
            json={"url": "https://example.com", "title": "Example", "snippet": "A test page", "source": "manual"},
            headers=_headers(),
        )
        assert resp.status_code == 201
        assert resp.json()["title"] == "Example"
        assert resp.json()["url"] == "https://example.com"

    def test_list_items(self, client):
        ws = client.post("/api/workspaces", json={"name": "List Items"}, headers=_headers()).json()
        client.post(
            f"/api/workspaces/{ws['id']}/items",
            json={"url": "https://a.com", "title": "A"},
            headers=_headers(),
        )
        client.post(
            f"/api/workspaces/{ws['id']}/items",
            json={"url": "https://b.com", "title": "B"},
            headers=_headers(),
        )
        resp = client.get(f"/api/workspaces/{ws['id']}/items", headers=_headers())
        assert resp.status_code == 200
        urls = {i["url"] for i in resp.json()}
        assert urls == {"https://a.com", "https://b.com"}

    def test_add_item_to_nonexistent_workspace(self, client):
        resp = client.post(
            "/api/workspaces/00000000-0000-0000-0000-000000000000/items",
            json={"url": "https://x.com"},
            headers=_headers(),
        )
        assert resp.status_code == 404

    def test_update_item(self, client):
        ws = client.post("/api/workspaces", json={"name": "Update Item"}, headers=_headers()).json()
        item = client.post(
            f"/api/workspaces/{ws['id']}/items",
            json={"url": "https://c.com", "title": "Old"},
            headers=_headers(),
        ).json()
        resp = client.patch(
            f"/api/workspaces/items/{item['id']}",
            json={"title": "New", "notes": "my note"},
            headers=_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "New"
        assert resp.json()["notes"] == "my note"

    def test_delete_item(self, client):
        ws = client.post("/api/workspaces", json={"name": "Delete Item"}, headers=_headers()).json()
        item = client.post(
            f"/api/workspaces/{ws['id']}/items",
            json={"url": "https://d.com"},
            headers=_headers(),
        ).json()
        resp = client.delete(f"/api/workspaces/items/{item['id']}", headers=_headers())
        assert resp.status_code == 200
        items = client.get(f"/api/workspaces/{ws['id']}/items", headers=_headers()).json()
        assert len(items) == 0

    def test_item_limit(self, client):
        ws = client.post("/api/workspaces", json={"name": "Limit Test"}, headers=_headers()).json()
        for i in range(100):
            resp = client.post(
                f"/api/workspaces/{ws['id']}/items",
                json={"url": f"https://test{i}.com", "title": f"Item {i}"},
                headers=_headers(),
            )
            assert resp.status_code == 201
        resp = client.post(
            f"/api/workspaces/{ws['id']}/items",
            json={"url": "https://overflow.com", "title": "Overflow"},
            headers=_headers(),
        )
        assert resp.status_code == 400
        assert "limit" in resp.json()["detail"].lower()

    def test_items_scoped_by_workspace(self, client):
        ws_a = client.post("/api/workspaces", json={"name": "WSA"}, headers=_headers()).json()
        ws_b = client.post("/api/workspaces", json={"name": "WSB"}, headers=_headers()).json()
        client.post(
            f"/api/workspaces/{ws_a['id']}/items",
            json={"url": "https://only-a.com"},
            headers=_headers(),
        ).json()
        items_b = client.get(f"/api/workspaces/{ws_b['id']}/items", headers=_headers()).json()
        assert len(items_b) == 0


class TestItemSummarize:
    def test_summarize_item_cached(self, client, monkeypatch):
        class FakeItem:
            id = "00000000-0000-0000-0000-000000000000"
            url = "https://example.com"
            summary = "Already summarized"
            title = "Test"

        mock = AsyncMock(return_value=FakeItem())
        monkeypatch.setattr("server.src.db.repository.WorkspaceItemRepo.get_by_id", mock)

        resp = client.post("/api/workspaces/items/00000000-0000-0000-0000-000000000000/summarize", headers=_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"] == "Already summarized"
        assert data["provider"] == "cached"
