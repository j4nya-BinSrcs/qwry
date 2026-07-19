from uuid import UUID

SESSION_ID = "canvas-test-session"
ANOTHER_SESSION = "canvas-other-session"


def _headers(sid: str | None = SESSION_ID) -> dict:
    return {"X-Session-Id": sid} if sid else {}


def _create_ws(client, name: str = "Canvas WS", session: str = SESSION_ID) -> dict:
    return client.post("/api/workspaces", json={"name": name}, headers=_headers(session)).json()


def _add_item(client, ws_id: str, url: str = "https://canvas-example.com", session: str = SESSION_ID) -> dict:
    return client.post(
        f"/api/workspaces/{ws_id}/items",
        json={"url": url, "title": "Canvas Example"},
        headers=_headers(session),
    ).json()


def _canvas(path: str, ws_id: str) -> str:
    return f"/api/workspaces/{ws_id}/canvas/{path}"


def _ai(path: str, ws_id: str) -> str:
    return f"/api/workspaces/{ws_id}/ai/{path}"


def _tasks(path: str, ws_id: str) -> str:
    return f"/api/workspaces/{ws_id}/tasks{path}"


# ── Canvas Nodes ───────────────────────────────────────────────────────────


class TestCanvasNodes:
    def test_create_and_list_nodes(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        resp = client.post(
            _canvas("nodes", ws["id"]),
            json={"object_type": "source", "object_id": item["id"], "x": 100, "y": 200, "label": "My Node"},
            headers=_headers(),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["object_type"] == "source"
        assert data["object_id"] == item["id"]
        assert data["x"] == 100
        assert data["y"] == 200
        assert data["label"] == "My Node"
        assert data["pinned"] is False
        assert "id" in data

        resp = client.get(_canvas("nodes", ws["id"]), headers=_headers())
        assert resp.status_code == 200
        ids = [n["id"] for n in resp.json()]
        assert data["id"] in ids

    def test_get_node(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        created = client.post(
            _canvas("nodes", ws["id"]),
            json={"object_type": "source", "object_id": item["id"], "x": 50, "y": 75},
            headers=_headers(),
        ).json()
        resp = client.get(_canvas("nodes", ws["id"]) + f"/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        assert resp.json()["x"] == 50
        assert resp.json()["y"] == 75

    def test_get_node_not_found(self, client):
        ws = _create_ws(client)
        resp = client.get(
            _canvas("nodes", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            headers=_headers(),
        )
        assert resp.status_code == 404

    def test_update_node_position(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        created = client.post(
            _canvas("nodes", ws["id"]),
            json={"object_type": "source", "object_id": item["id"], "x": 0, "y": 0},
            headers=_headers(),
        ).json()
        resp = client.patch(
            _canvas("nodes", ws["id"]) + f"/{created['id']}",
            json={"x": 300, "y": 400, "label": "Moved"},
            headers=_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["x"] == 300
        assert resp.json()["y"] == 400
        assert resp.json()["label"] == "Moved"

    def test_update_node_partial(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        created = client.post(
            _canvas("nodes", ws["id"]),
            json={"object_type": "source", "object_id": item["id"], "x": 10, "y": 20, "label": "Original", "pinned": False},
            headers=_headers(),
        ).json()
        resp = client.patch(
            _canvas("nodes", ws["id"]) + f"/{created['id']}",
            json={"pinned": True},
            headers=_headers(),
        )
        assert resp.status_code == 200
        d = resp.json()
        assert d["pinned"] is True
        assert d["x"] == 10
        assert d["y"] == 20
        assert d["label"] == "Original"

    def test_update_node_not_found(self, client):
        ws = _create_ws(client)
        resp = client.patch(
            _canvas("nodes", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            json={"x": 99},
            headers=_headers(),
        )
        assert resp.status_code == 404

    def test_delete_node(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        created = client.post(
            _canvas("nodes", ws["id"]),
            json={"object_type": "source", "object_id": item["id"]},
            headers=_headers(),
        ).json()
        resp = client.delete(_canvas("nodes", ws["id"]) + f"/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"
        remaining = client.get(_canvas("nodes", ws["id"]), headers=_headers()).json()
        assert len(remaining) == 0

    def test_delete_node_not_found(self, client):
        ws = _create_ws(client)
        resp = client.delete(
            _canvas("nodes", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            headers=_headers(),
        )
        assert resp.status_code == 404

    def test_nodes_scoped_by_workspace(self, client):
        ws_a = _create_ws(client, "Canvas WS A")
        ws_b = _create_ws(client, "Canvas WS B")
        item_a = _add_item(client, ws_a["id"])
        item_b = _add_item(client, ws_b["id"])
        client.post(_canvas("nodes", ws_a["id"]), json={"object_type": "source", "object_id": item_a["id"]}, headers=_headers())
        client.post(_canvas("nodes", ws_b["id"]), json={"object_type": "source", "object_id": item_b["id"]}, headers=_headers())
        nodes_a = client.get(_canvas("nodes", ws_a["id"]), headers=_headers()).json()
        nodes_b = client.get(_canvas("nodes", ws_b["id"]), headers=_headers()).json()
        assert len(nodes_a) == 1
        assert len(nodes_b) == 1
        assert nodes_a[0]["id"] != nodes_b[0]["id"]

    def test_create_node_with_all_fields(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        resp = client.post(
            _canvas("nodes", ws["id"]),
            json={
                "object_type": "note",
                "object_id": item["id"],
                "x": 150.5,
                "y": 250.75,
                "width": 300,
                "height": 200,
                "z_index": 5,
                "pinned": True,
                "label": "Pinned Note",
                "color": "#ff0000",
            },
            headers=_headers(),
        )
        assert resp.status_code == 201
        d = resp.json()
        assert d["x"] == 150.5
        assert d["y"] == 250.75
        assert d["width"] == 300
        assert d["height"] == 200
        assert d["z_index"] == 5
        assert d["pinned"] is True
        assert d["label"] == "Pinned Note"
        assert d["color"] == "#ff0000"


# ── Canvas Connections ─────────────────────────────────────────────────────


class TestCanvasConnections:
    def test_create_and_list_connections(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        n1 = client.post(_canvas("nodes", ws["id"]), json={"object_type": "source", "object_id": item["id"]}, headers=_headers()).json()
        n2 = client.post(_canvas("nodes", ws["id"]), json={"object_type": "source", "object_id": item["id"]}, headers=_headers()).json()
        resp = client.post(
            _canvas("connections", ws["id"]),
            json={"source_node_id": n1["id"], "target_node_id": n2["id"], "label": "connects to", "color": "#00ff00"},
            headers=_headers(),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["source_node_id"] == n1["id"]
        assert data["target_node_id"] == n2["id"]
        assert data["label"] == "connects to"
        assert data["color"] == "#00ff00"
        assert data["style"] == "solid"
        assert "id" in data

        resp = client.get(_canvas("connections", ws["id"]), headers=_headers())
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()]
        assert data["id"] in ids

    def test_create_connection_with_dashed_style(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        n1 = client.post(_canvas("nodes", ws["id"]), json={"object_type": "source", "object_id": item["id"]}, headers=_headers()).json()
        n2 = client.post(_canvas("nodes", ws["id"]), json={"object_type": "source", "object_id": item["id"]}, headers=_headers()).json()
        resp = client.post(
            _canvas("connections", ws["id"]),
            json={"source_node_id": n1["id"], "target_node_id": n2["id"], "style": "dashed"},
            headers=_headers(),
        )
        assert resp.status_code == 201
        assert resp.json()["style"] == "dashed"

    def test_delete_connection(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        n1 = client.post(_canvas("nodes", ws["id"]), json={"object_type": "source", "object_id": item["id"]}, headers=_headers()).json()
        n2 = client.post(_canvas("nodes", ws["id"]), json={"object_type": "source", "object_id": item["id"]}, headers=_headers()).json()
        created = client.post(
            _canvas("connections", ws["id"]),
            json={"source_node_id": n1["id"], "target_node_id": n2["id"]},
            headers=_headers(),
        ).json()
        resp = client.delete(_canvas("connections", ws["id"]) + f"/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        remaining = client.get(_canvas("connections", ws["id"]), headers=_headers()).json()
        assert len(remaining) == 0

    def test_delete_connection_not_found(self, client):
        ws = _create_ws(client)
        resp = client.delete(
            _canvas("connections", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            headers=_headers(),
        )
        assert resp.status_code == 404

    def test_connections_scoped_by_workspace(self, client):
        ws_a = _create_ws(client, "Conn WS A")
        ws_b = _create_ws(client, "Conn WS B")
        item = _add_item(client, ws_a["id"])
        n1 = client.post(_canvas("nodes", ws_a["id"]), json={"object_type": "source", "object_id": item["id"]}, headers=_headers()).json()
        n2 = client.post(_canvas("nodes", ws_a["id"]), json={"object_type": "source", "object_id": item["id"]}, headers=_headers()).json()
        client.post(_canvas("connections", ws_a["id"]), json={"source_node_id": n1["id"], "target_node_id": n2["id"]}, headers=_headers())
        conns_a = client.get(_canvas("connections", ws_a["id"]), headers=_headers()).json()
        conns_b = client.get(_canvas("connections", ws_b["id"]), headers=_headers()).json()
        assert len(conns_a) == 1
        assert len(conns_b) == 0


# ── AI Responses ───────────────────────────────────────────────────────────


class TestWorkspaceAIResponses:
    def test_create_and_list_ai_responses(self, client):
        ws = _create_ws(client)
        resp = client.post(
            _ai("responses", ws["id"]),
            json={"title": "GPT Summary", "prompt": "Summarize X", "response_text": "X is Y", "model": "gpt-4", "tokens_in": 50, "tokens_out": 100},
            headers=_headers(),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "GPT Summary"
        assert data["prompt"] == "Summarize X"
        assert data["response_text"] == "X is Y"
        assert data["model"] == "gpt-4"
        assert data["tokens_in"] == 50
        assert data["tokens_out"] == 100

        resp = client.get(_ai("responses", ws["id"]), headers=_headers())
        assert resp.status_code == 200
        ids = [r["id"] for r in resp.json()]
        assert data["id"] in ids

    def test_update_ai_response(self, client):
        ws = _create_ws(client)
        created = client.post(
            _ai("responses", ws["id"]),
            json={"title": "Old Title", "response_text": "Old text"},
            headers=_headers(),
        ).json()
        resp = client.patch(
            _ai("responses", ws["id"]) + f"/{created['id']}",
            json={"title": "New Title", "response_text": "New text"},
            headers=_headers(),
        )
        assert resp.status_code == 200
        d = resp.json()
        assert d["title"] == "New Title"
        assert d["response_text"] == "New text"

    def test_update_ai_response_not_found(self, client):
        ws = _create_ws(client)
        resp = client.patch(
            _ai("responses", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            json={"title": "Nope"},
            headers=_headers(),
        )
        assert resp.status_code == 404

    def test_delete_ai_response(self, client):
        ws = _create_ws(client)
        created = client.post(_ai("responses", ws["id"]), json={"title": "To Delete"}, headers=_headers()).json()
        resp = client.delete(_ai("responses", ws["id"]) + f"/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        remaining = client.get(_ai("responses", ws["id"]), headers=_headers()).json()
        assert len(remaining) == 0

    def test_delete_ai_response_not_found(self, client):
        ws = _create_ws(client)
        resp = client.delete(
            _ai("responses", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            headers=_headers(),
        )
        assert resp.status_code == 404

    def test_ai_responses_scoped_by_workspace(self, client):
        ws_a = _create_ws(client, "AI WS A")
        ws_b = _create_ws(client, "AI WS B")
        client.post(_ai("responses", ws_a["id"]), json={"title": "A1"}, headers=_headers())
        client.post(_ai("responses", ws_b["id"]), json={"title": "B1"}, headers=_headers())
        list_a = client.get(_ai("responses", ws_a["id"]), headers=_headers()).json()
        list_b = client.get(_ai("responses", ws_b["id"]), headers=_headers()).json()
        assert len(list_a) == 1
        assert len(list_b) == 1
        assert list_a[0]["id"] != list_b[0]["id"]


# ── Tasks ──────────────────────────────────────────────────────────────────


class TestWorkspaceTasks:
    def test_create_and_list_tasks(self, client):
        ws = _create_ws(client)
        resp = client.post(
            _tasks("", ws["id"]),
            json={"title": "Research quantum computing", "description": "Deep dive into QC", "priority": "high"},
            headers=_headers(),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Research quantum computing"
        assert data["description"] == "Deep dive into QC"
        assert data["status"] == "pending"
        assert data["priority"] == "high"
        assert data["completed_at"] is None
        assert "id" in data

        resp = client.get(_tasks("", ws["id"]), headers=_headers())
        assert resp.status_code == 200
        ids = [t["id"] for t in resp.json()]
        assert data["id"] in ids

    def test_create_task_with_all_fields(self, client):
        ws = _create_ws(client)
        from datetime import datetime, timezone
        due = datetime(2026, 12, 31, tzinfo=timezone.utc).isoformat()
        resp = client.post(
            _tasks("", ws["id"]),
            json={"title": "Complete project", "description": "Finish by EOY", "status": "in_progress", "priority": "medium", "due_date": due, "assignee": "alice"},
            headers=_headers(),
        )
        assert resp.status_code == 201
        d = resp.json()
        assert d["title"] == "Complete project"
        assert d["status"] == "in_progress"
        assert d["priority"] == "medium"
        assert d["assignee"] == "alice"

    def test_update_task(self, client):
        ws = _create_ws(client)
        created = client.post(_tasks("", ws["id"]), json={"title": "Old Task"}, headers=_headers()).json()
        resp = client.patch(
            _tasks("/" + created["id"], ws["id"]),
            json={"title": "Updated Task", "priority": "high"},
            headers=_headers(),
        )
        assert resp.status_code == 200
        d = resp.json()
        assert d["title"] == "Updated Task"
        assert d["priority"] == "high"

    def test_update_task_status_to_completed(self, client):
        ws = _create_ws(client)
        created = client.post(_tasks("", ws["id"]), json={"title": "Finish me"}, headers=_headers()).json()
        resp = client.patch(
            _tasks("/" + created["id"], ws["id"]),
            json={"status": "completed"},
            headers=_headers(),
        )
        assert resp.status_code == 200
        d = resp.json()
        assert d["status"] == "completed"
        assert d["completed_at"] is not None

    def test_update_task_not_found(self, client):
        ws = _create_ws(client)
        resp = client.patch(
            _tasks("/00000000-0000-0000-0000-000000000000", ws["id"]),
            json={"title": "Nope"},
            headers=_headers(),
        )
        assert resp.status_code == 404

    def test_delete_task(self, client):
        ws = _create_ws(client)
        created = client.post(_tasks("", ws["id"]), json={"title": "Delete Me"}, headers=_headers()).json()
        resp = client.delete(_tasks("/" + created["id"], ws["id"]), headers=_headers())
        assert resp.status_code == 200
        remaining = client.get(_tasks("", ws["id"]), headers=_headers()).json()
        assert len(remaining) == 0

    def test_delete_task_not_found(self, client):
        ws = _create_ws(client)
        resp = client.delete(
            _tasks("/00000000-0000-0000-0000-000000000000", ws["id"]),
            headers=_headers(),
        )
        assert resp.status_code == 404

    def test_tasks_scoped_by_workspace(self, client):
        ws_a = _create_ws(client, "Task WS A")
        ws_b = _create_ws(client, "Task WS B")
        client.post(_tasks("", ws_a["id"]), json={"title": "Task A"}, headers=_headers())
        client.post(_tasks("", ws_b["id"]), json={"title": "Task B"}, headers=_headers())
        tasks_a = client.get(_tasks("", ws_a["id"]), headers=_headers()).json()
        tasks_b = client.get(_tasks("", ws_b["id"]), headers=_headers()).json()
        assert len(tasks_a) == 1
        assert len(tasks_b) == 1
        assert tasks_a[0]["id"] != tasks_b[0]["id"]


# ── Auth / Isolation ───────────────────────────────────────────────────────


class TestCanvasAuth:
    def test_session_isolation(self, client):
        ws_a = _create_ws(client, "Canvas Auth A")
        ws_b = _create_ws(client, "Canvas Auth B", ANOTHER_SESSION)
        resp_a = client.get(_canvas("nodes", ws_a["id"]), headers=_headers(SESSION_ID))
        resp_b = client.get(_canvas("nodes", ws_b["id"]), headers=_headers(ANOTHER_SESSION))
        assert resp_a.status_code == 200
        assert resp_b.status_code == 200

    def test_other_session_cannot_access(self, client):
        ws = _create_ws(client, "Private Canvas", SESSION_ID)
        resp = client.get(_canvas("nodes", ws["id"]), headers=_headers(ANOTHER_SESSION))
        assert resp.status_code == 404


class TestCanvasNotFound:
    def test_nonexistent_workspace(self, client):
        bad_id = "00000000-0000-0000-0000-000000000000"
        endpoints = [
            ("GET", _canvas("nodes", bad_id)),
            ("POST", _canvas("nodes", bad_id)),
            ("GET", _canvas("connections", bad_id)),
            ("POST", _canvas("connections", bad_id)),
        ]
        bodies = {
            ("POST", _canvas("nodes", bad_id)): {"object_type": "source", "object_id": "00000000-0000-0000-0000-000000000000"},
            ("POST", _canvas("connections", bad_id)): {"source_node_id": "00000000-0000-0000-0000-000000000000", "target_node_id": "00000000-0000-0000-0000-000000000000"},
        }
        for method, path in endpoints:
            if method == "GET":
                resp = client.get(path, headers=_headers())
            else:
                resp = client.post(path, json=bodies.get((method, path), {}), headers=_headers())
            assert resp.status_code == 404, f"{method} {path} expected 404, got {resp.status_code}"


class TestCanvasTasksNotFound:
    def test_nonexistent_workspace(self, client):
        bad_id = "00000000-0000-0000-0000-000000000000"
        endpoints = [
            ("GET", _tasks("", bad_id)),
            ("POST", _tasks("", bad_id)),
            ("GET", _ai("responses", bad_id)),
            ("POST", _ai("responses", bad_id)),
        ]
        bodies = {
            ("POST", _tasks("", bad_id)): {"title": "Test"},
            ("POST", _ai("responses", bad_id)): {"title": "Test"},
        }
        for method, path in endpoints:
            if method == "GET":
                resp = client.get(path, headers=_headers())
            else:
                resp = client.post(path, json=bodies.get((method, path), {}), headers=_headers())
            assert resp.status_code == 404, f"{method} {path} expected 404, got {resp.status_code}"
