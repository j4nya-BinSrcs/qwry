from uuid import UUID

SESSION_ID = "station-test-session"
ANOTHER_SESSION = "station-other-session"


def _headers(sid: str | None = SESSION_ID) -> dict:
    return {"X-Session-Id": sid} if sid else {}


def _create_ws(client, name: str = "Station WS", session: str = SESSION_ID) -> dict:
    return client.post("/api/workspaces", json={"name": name}, headers=_headers(session)).json()


def _add_item(client, ws_id: str, url: str = "https://example.com", session: str = SESSION_ID) -> dict:
    return client.post(
        f"/api/workspaces/{ws_id}/items",
        json={"url": url, "title": "Example"},
        headers=_headers(session),
    ).json()


def _station(path: str, ws_id: str) -> str:
    return f"/api/workspaces/{ws_id}/station/{path}"


class TestStationReads:
    def test_create_and_list_reads(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        resp = client.post(_station("reads", ws["id"]), json={"item_id": item["id"], "status": "unread"}, headers=_headers())
        assert resp.status_code == 201
        data = resp.json()
        assert data["item_id"] == item["id"]
        assert data["status"] == "unread"
        assert "id" in data

        resp = client.get(_station("reads", ws["id"]), headers=_headers())
        assert resp.status_code == 200
        ids = [r["id"] for r in resp.json()]
        assert data["id"] in ids

    def test_update_read_status(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        created = client.post(_station("reads", ws["id"]), json={"item_id": item["id"], "status": "unread"}, headers=_headers()).json()
        resp = client.patch(
            _station("reads", ws["id"]) + f"/{created['id']}",
            json={"status": "reading"},
            headers=_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "reading"

    def test_delete_read(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        created = client.post(_station("reads", ws["id"]), json={"item_id": item["id"], "status": "unread"}, headers=_headers()).json()
        resp = client.delete(_station("reads", ws["id"]) + f"/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"
        resp = client.get(_station("reads", ws["id"]), headers=_headers())
        assert len(resp.json()) == 0

    def test_delete_read_not_found(self, client):
        ws = _create_ws(client)
        resp = client.delete(
            _station("reads", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            headers=_headers(),
        )
        assert resp.status_code == 404

    def test_update_read_not_found(self, client):
        ws = _create_ws(client)
        resp = client.patch(
            _station("reads", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            json={"status": "reading"},
            headers=_headers(),
        )
        assert resp.status_code == 404

    def test_reads_scoped_by_workspace(self, client):
        ws_a = _create_ws(client, "Read WS A")
        ws_b = _create_ws(client, "Read WS B")
        item_a = _add_item(client, ws_a["id"])
        item_b = _add_item(client, ws_b["id"])
        client.post(_station("reads", ws_a["id"]), json={"item_id": item_a["id"]}, headers=_headers())
        client.post(_station("reads", ws_b["id"]), json={"item_id": item_b["id"]}, headers=_headers())
        reads_a = client.get(_station("reads", ws_a["id"]), headers=_headers()).json()
        reads_b = client.get(_station("reads", ws_b["id"]), headers=_headers()).json()
        assert len(reads_a) == 1
        assert len(reads_b) == 1
        assert reads_a[0]["id"] != reads_b[0]["id"]


class TestStationHighlights:
    def test_create_and_list_highlights(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        resp = client.post(
            _station("highlights", ws["id"]),
            json={"item_id": item["id"], "text": "important passage", "color": "yellow"},
            headers=_headers(),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["text"] == "important passage"
        assert data["color"] == "yellow"

        resp = client.get(_station("highlights", ws["id"]), headers=_headers())
        assert resp.status_code == 200
        assert data["id"] in [h["id"] for h in resp.json()]

    def test_create_highlight_with_note(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        resp = client.post(
            _station("highlights", ws["id"]),
            json={"item_id": item["id"], "text": "key quote", "note": "my note", "page_url": "https://example.com#frag"},
            headers=_headers(),
        )
        assert resp.status_code == 201
        assert resp.json()["note"] == "my note"
        assert resp.json()["page_url"] == "https://example.com#frag"

    def test_delete_highlight(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        created = client.post(
            _station("highlights", ws["id"]),
            json={"item_id": item["id"], "text": "delete me"},
            headers=_headers(),
        ).json()
        resp = client.delete(_station("highlights", ws["id"]) + f"/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        remaining = client.get(_station("highlights", ws["id"]), headers=_headers()).json()
        assert len(remaining) == 0

    def test_delete_highlight_not_found(self, client):
        ws = _create_ws(client)
        resp = client.delete(
            _station("highlights", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            headers=_headers(),
        )
        assert resp.status_code == 404


class TestStationNotes:
    def test_create_and_list_notes(self, client):
        ws = _create_ws(client)
        resp = client.post(_station("notes", ws["id"]), json={"title": "My Note", "content": "Hello"}, headers=_headers())
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "My Note"
        assert data["content"] == "Hello"
        resp = client.get(_station("notes", ws["id"]), headers=_headers())
        assert data["id"] in [n["id"] for n in resp.json()]

    def test_update_note(self, client):
        ws = _create_ws(client)
        created = client.post(_station("notes", ws["id"]), json={"title": "Old", "content": "Old content"}, headers=_headers()).json()
        resp = client.patch(
            _station("notes", ws["id"]) + f"/{created['id']}",
            json={"title": "New", "content": "New content"},
            headers=_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "New"
        assert resp.json()["content"] == "New content"

    def test_update_note_partial(self, client):
        ws = _create_ws(client)
        created = client.post(_station("notes", ws["id"]), json={"title": "Partial", "content": "C"}, headers=_headers()).json()
        resp = client.patch(
            _station("notes", ws["id"]) + f"/{created['id']}",
            json={"content": "Updated content only"},
            headers=_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Partial"
        assert resp.json()["content"] == "Updated content only"

    def test_delete_note(self, client):
        ws = _create_ws(client)
        created = client.post(_station("notes", ws["id"]), json={"title": "Delete Me", "content": ""}, headers=_headers()).json()
        resp = client.delete(_station("notes", ws["id"]) + f"/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        remaining = client.get(_station("notes", ws["id"]), headers=_headers()).json()
        assert len(remaining) == 0

    def test_delete_note_not_found(self, client):
        ws = _create_ws(client)
        resp = client.delete(
            _station("notes", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            headers=_headers(),
        )
        assert resp.status_code == 404


class TestStationPins:
    def test_create_and_list_pins(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        resp = client.post(
            _station("pins", ws["id"]),
            json={"pinnable_type": "item", "pinnable_id": item["id"]},
            headers=_headers(),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["pinnable_type"] == "item"
        assert data["pinnable_id"] == item["id"]
        resp = client.get(_station("pins", ws["id"]), headers=_headers())
        assert data["id"] in [p["id"] for p in resp.json()]

    def test_reorder_pins(self, client):
        ws = _create_ws(client)
        item_a = _add_item(client, ws["id"], "https://a.com")
        item_b = _add_item(client, ws["id"], "https://b.com")
        pin_a = client.post(_station("pins", ws["id"]), json={"pinnable_type": "item", "pinnable_id": item_a["id"]}, headers=_headers()).json()
        pin_b = client.post(_station("pins", ws["id"]), json={"pinnable_type": "item", "pinnable_id": item_b["id"]}, headers=_headers()).json()
        resp = client.put(
            _station("pins", ws["id"]) + "/reorder",
            json={"pin_ids": [pin_b["id"], pin_a["id"]]},
            headers=_headers(),
        )
        assert resp.status_code == 200
        ordered = resp.json()
        assert ordered[0]["id"] == pin_b["id"]
        assert ordered[1]["id"] == pin_a["id"]

    def test_delete_pin(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        created = client.post(_station("pins", ws["id"]), json={"pinnable_type": "item", "pinnable_id": item["id"]}, headers=_headers()).json()
        resp = client.delete(_station("pins", ws["id"]) + f"/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        remaining = client.get(_station("pins", ws["id"]), headers=_headers()).json()
        assert len(remaining) == 0

    def test_delete_pin_not_found(self, client):
        ws = _create_ws(client)
        resp = client.delete(
            _station("pins", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            headers=_headers(),
        )
        assert resp.status_code == 404


class TestStationImages:
    def test_create_and_list_images(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        resp = client.post(
            _station("images", ws["id"]),
            json={"url": "https://example.com/img.png", "item_id": item["id"], "caption": "A image"},
            headers=_headers(),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["url"] == "https://example.com/img.png"
        assert data["caption"] == "A image"
        resp = client.get(_station("images", ws["id"]), headers=_headers())
        assert data["id"] in [i["id"] for i in resp.json()]

    def test_create_image_without_item(self, client):
        ws = _create_ws(client)
        resp = client.post(
            _station("images", ws["id"]),
            json={"url": "https://example.com/img.png", "caption": "No item"},
            headers=_headers(),
        )
        assert resp.status_code == 201
        assert resp.json()["item_id"] is None

    def test_delete_image(self, client):
        ws = _create_ws(client)
        created = client.post(_station("images", ws["id"]), json={"url": "https://example.com/del.png"}, headers=_headers()).json()
        resp = client.delete(_station("images", ws["id"]) + f"/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        remaining = client.get(_station("images", ws["id"]), headers=_headers()).json()
        assert len(remaining) == 0

    def test_delete_image_not_found(self, client):
        ws = _create_ws(client)
        resp = client.delete(
            _station("images", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            headers=_headers(),
        )
        assert resp.status_code == 404


class TestStationVideos:
    def test_create_and_list_videos(self, client):
        ws = _create_ws(client)
        resp = client.post(
            _station("videos", ws["id"]),
            json={"url": "https://youtube.com/watch?v=test", "title": "Test Video", "platform": "youtube"},
            headers=_headers(),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["url"] == "https://youtube.com/watch?v=test"
        assert data["platform"] == "youtube"
        resp = client.get(_station("videos", ws["id"]), headers=_headers())
        assert data["id"] in [v["id"] for v in resp.json()]

    def test_update_video(self, client):
        ws = _create_ws(client)
        created = client.post(
            _station("videos", ws["id"]),
            json={"url": "https://youtube.com/watch?v=old", "title": "Old"},
            headers=_headers(),
        ).json()
        resp = client.patch(
            _station("videos", ws["id"]) + f"/{created['id']}",
            json={"title": "New Title", "duration_secs": 120},
            headers=_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "New Title"
        assert resp.json()["duration_secs"] == 120
        assert resp.json()["url"] == "https://youtube.com/watch?v=old"

    def test_delete_video(self, client):
        ws = _create_ws(client)
        created = client.post(_station("videos", ws["id"]), json={"url": "https://youtube.com/watch?v=del"}, headers=_headers()).json()
        resp = client.delete(_station("videos", ws["id"]) + f"/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        remaining = client.get(_station("videos", ws["id"]), headers=_headers()).json()
        assert len(remaining) == 0

    def test_delete_video_not_found(self, client):
        ws = _create_ws(client)
        resp = client.delete(
            _station("videos", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            headers=_headers(),
        )
        assert resp.status_code == 404


class TestStationComparisons:
    def test_create_and_list_comparisons(self, client):
        ws = _create_ws(client)
        resp = client.post(
            _station("comparisons", ws["id"]),
            json={"title": "Compare A vs B", "data": {"a": 1, "b": 2}},
            headers=_headers(),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Compare A vs B"
        assert data["data"] == {"a": 1, "b": 2}
        resp = client.get(_station("comparisons", ws["id"]), headers=_headers())
        assert data["id"] in [c["id"] for c in resp.json()]

    def test_update_comparison(self, client):
        ws = _create_ws(client)
        created = client.post(_station("comparisons", ws["id"]), json={"title": "Old"}, headers=_headers()).json()
        resp = client.patch(
            _station("comparisons", ws["id"]) + f"/{created['id']}",
            json={"title": "New", "data": {"x": 10}},
            headers=_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "New"
        assert resp.json()["data"] == {"x": 10}

    def test_delete_comparison(self, client):
        ws = _create_ws(client)
        created = client.post(_station("comparisons", ws["id"]), json={"title": "Del"}, headers=_headers()).json()
        resp = client.delete(_station("comparisons", ws["id"]) + f"/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        remaining = client.get(_station("comparisons", ws["id"]), headers=_headers()).json()
        assert len(remaining) == 0

    def test_delete_comparison_not_found(self, client):
        ws = _create_ws(client)
        resp = client.delete(
            _station("comparisons", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            headers=_headers(),
        )
        assert resp.status_code == 404


class TestStationTimeline:
    def test_timeline_records_actions(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])

        client.post(_station("reads", ws["id"]), json={"item_id": item["id"]}, headers=_headers())
        client.post(_station("notes", ws["id"]), json={"title": "A Note"}, headers=_headers())
        client.post(_station("pins", ws["id"]), json={"pinnable_type": "item", "pinnable_id": item["id"]}, headers=_headers())

        resp = client.get(_station("timeline", ws["id"]), headers=_headers())
        assert resp.status_code == 200
        events = resp.json()
        action_types = [e["action_type"] for e in events]
        assert "created" in action_types
        object_types = [e["object_type"] for e in events]
        assert "read" in object_types
        assert "note" in object_types
        assert "pin" in object_types

    def test_timeline_empty_workspace(self, client):
        ws = _create_ws(client)
        resp = client.get(_station("timeline", ws["id"]), headers=_headers())
        assert resp.status_code == 200
        assert resp.json() == []

    def test_timeline_not_found(self, client):
        resp = client.get(
            _station("timeline", "00000000-0000-0000-0000-000000000000"),
            headers=_headers(),
        )
        assert resp.status_code == 404


class TestStationTags:
    def test_create_and_list_tags(self, client):
        ws = _create_ws(client)
        resp = client.post(_station("tags", ws["id"]), json={"name": "important", "color": "red"}, headers=_headers())
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "important"
        assert data["color"] == "red"
        resp = client.get(_station("tags", ws["id"]), headers=_headers())
        assert data["id"] in [t["id"] for t in resp.json()]

    def test_create_tag_without_color(self, client):
        ws = _create_ws(client)
        resp = client.post(_station("tags", ws["id"]), json={"name": "plain"}, headers=_headers())
        assert resp.status_code == 201
        assert resp.json()["color"] is None

    def test_assign_and_unassign_tag(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        tag = client.post(_station("tags", ws["id"]), json={"name": "research"}, headers=_headers()).json()
        resp = client.post(
            _station("tags", ws["id"]) + f"/{tag['id']}/assign",
            json={"object_type": "item", "object_id": item["id"]},
            headers=_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "assigned"
        objects = client.get(_station("tags", ws["id"]) + f"/{tag['id']}/objects", headers=_headers()).json()
        assert len(objects) == 1
        assert objects[0]["object_id"] == item["id"]
        resp = client.post(
            _station("tags", ws["id"]) + f"/{tag['id']}/unassign",
            json={"object_type": "item", "object_id": item["id"]},
            headers=_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "unassigned"
        objects = client.get(_station("tags", ws["id"]) + f"/{tag['id']}/objects", headers=_headers()).json()
        assert len(objects) == 0

    def test_unassign_nonexistent_tagging(self, client):
        ws = _create_ws(client)
        tag = client.post(_station("tags", ws["id"]), json={"name": "orphan"}, headers=_headers()).json()
        resp = client.post(
            _station("tags", ws["id"]) + f"/{tag['id']}/unassign",
            json={"object_type": "item", "object_id": "00000000-0000-0000-0000-000000000000"},
            headers=_headers(),
        )
        assert resp.status_code == 404

    def test_delete_tag(self, client):
        ws = _create_ws(client)
        created = client.post(_station("tags", ws["id"]), json={"name": "Delete Me"}, headers=_headers()).json()
        resp = client.delete(_station("tags", ws["id"]) + f"/{created['id']}", headers=_headers())
        assert resp.status_code == 200
        remaining = client.get(_station("tags", ws["id"]), headers=_headers()).json()
        assert len(remaining) == 0

    def test_delete_tag_not_found(self, client):
        ws = _create_ws(client)
        resp = client.delete(
            _station("tags", ws["id"]) + "/00000000-0000-0000-0000-000000000000",
            headers=_headers(),
        )
        assert resp.status_code == 404


class TestStationStats:
    def test_stats_counts(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])

        client.post(_station("reads", ws["id"]), json={"item_id": item["id"]}, headers=_headers())
        client.post(_station("highlights", ws["id"]), json={"item_id": item["id"], "text": "hi"}, headers=_headers())
        client.post(_station("notes", ws["id"]), json={"title": "Note"}, headers=_headers())
        client.post(_station("pins", ws["id"]), json={"pinnable_type": "item", "pinnable_id": item["id"]}, headers=_headers())
        client.post(_station("images", ws["id"]), json={"url": "https://img.png"}, headers=_headers())
        client.post(_station("videos", ws["id"]), json={"url": "https://vid"}, headers=_headers())
        client.post(_station("comparisons", ws["id"]), json={"title": "Cmp"}, headers=_headers())
        client.post(_station("tags", ws["id"]), json={"name": "t1"}, headers=_headers())

        resp = client.get(_station("stats", ws["id"]), headers=_headers())
        assert resp.status_code == 200
        s = resp.json()
        assert s["reads"] >= 1
        assert s["highlights"] >= 1
        assert s["notes"] >= 1
        assert s["pins"] >= 1
        assert s["images"] >= 1
        assert s["videos"] >= 1
        assert s["comparisons"] >= 1
        assert s["tags"] >= 1
        assert s["sources"] >= 1

    def test_stats_empty_workspace(self, client):
        ws = _create_ws(client)
        resp = client.get(_station("stats", ws["id"]), headers=_headers())
        assert resp.status_code == 200
        s = resp.json()
        for key in ("reads", "highlights", "notes", "pins", "images", "videos", "comparisons", "tags", "sources"):
            assert s[key] == 0

    def test_stats_not_found(self, client):
        resp = client.get(
            _station("stats", "00000000-0000-0000-0000-000000000000"),
            headers=_headers(),
        )
        assert resp.status_code == 404


class TestStationSearch:
    def test_search_items(self, client):
        ws = _create_ws(client)
        _add_item(client, ws["id"], "https://python.org")
        _add_item(client, ws["id"], "https://rust-lang.org")
        client.post(
            f"/api/workspaces/{ws['id']}/items",
            json={"url": "https://example.com", "title": "Target Article", "snippet": "This is the one we want"},
            headers=_headers(),
        )
        resp = client.get(_station("search", ws["id"]) + "?q=target", headers=_headers())
        assert resp.status_code == 200
        results = resp.json()
        assert len(results) >= 1
        assert any("Target" in r["title"] for r in results)

    def test_search_notes(self, client):
        ws = _create_ws(client)
        client.post(_station("notes", ws["id"]), json={"title": "Research Notes", "content": "Quantum physics is fascinating"}, headers=_headers())
        client.post(_station("notes", ws["id"]), json={"title": "Shopping List", "content": "Milk, eggs"}, headers=_headers())
        resp = client.get(_station("search", ws["id"]) + "?q=quantum", headers=_headers())
        assert resp.status_code == 200
        results = resp.json()
        assert len(results) >= 1
        assert any("Research Notes" in r["title"] for r in results)

    def test_search_no_results(self, client):
        ws = _create_ws(client)
        resp = client.get(_station("search", ws["id"]) + "?q=zzzznonexistent", headers=_headers())
        assert resp.status_code == 200
        assert resp.json() == []

    def test_search_not_found(self, client):
        resp = client.get(
            _station("search", "00000000-0000-0000-0000-000000000000") + "?q=test",
            headers=_headers(),
        )
        assert resp.status_code == 404


class TestStationLoadAll:
    def test_load_all_empty(self, client):
        ws = _create_ws(client)
        resp = client.get(_station("load-all", ws["id"]), headers=_headers())
        assert resp.status_code == 200
        data = resp.json()
        for key in ("reads", "highlights", "notes", "pins", "images", "videos", "comparisons", "tags", "timeline"):
            assert key in data
            assert isinstance(data[key], list)
        assert "stats" in data

    def test_load_all_populated(self, client):
        ws = _create_ws(client)
        item = _add_item(client, ws["id"])
        client.post(_station("notes", ws["id"]), json={"title": "A Note"}, headers=_headers())
        client.post(_station("reads", ws["id"]), json={"item_id": item["id"]}, headers=_headers())
        resp = client.get(_station("load-all", ws["id"]), headers=_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["notes"]) == 1
        assert len(data["reads"]) == 1
        assert data["stats"]["notes"] >= 1
        assert data["stats"]["reads"] >= 1

    def test_load_all_not_found(self, client):
        resp = client.get(
            _station("load-all", "00000000-0000-0000-0000-000000000000"),
            headers=_headers(),
        )
        assert resp.status_code == 404


class TestStationAuth:
    def test_session_isolation(self, client):
        ws_a = _create_ws(client, "Auth WS A")
        ws_b = _create_ws(client, "Auth WS B", ANOTHER_SESSION)
        resp_a = client.get(_station("reads", ws_a["id"]), headers=_headers(SESSION_ID))
        resp_b = client.get(_station("reads", ws_b["id"]), headers=_headers(ANOTHER_SESSION))
        assert resp_a.status_code == 200
        assert resp_b.status_code == 200

    def test_other_session_cannot_access(self, client):
        ws = _create_ws(client, "Private WS", SESSION_ID)
        resp = client.get(_station("reads", ws["id"]), headers=_headers(ANOTHER_SESSION))
        assert resp.status_code == 404


class TestStationNotFound:
    def test_nonexistent_workspace(self, client):
        bad_id = "00000000-0000-0000-0000-000000000000"
        endpoints = [
            ("GET", _station("reads", bad_id)),
            ("POST", _station("reads", bad_id)),
            ("GET", _station("notes", bad_id)),
            ("POST", _station("notes", bad_id)),
            ("GET", _station("pins", bad_id)),
            ("POST", _station("pins", bad_id)),
            ("GET", _station("tags", bad_id)),
            ("POST", _station("tags", bad_id)),
            ("GET", _station("stats", bad_id)),
            ("GET", _station("search", bad_id) + "?q=test"),
            ("GET", _station("timeline", bad_id)),
            ("GET", _station("load-all", bad_id)),
        ]
        bodies = {
            ("POST", _station("reads", bad_id)): {"item_id": "00000000-0000-0000-0000-000000000000", "status": "unread"},
            ("POST", _station("notes", bad_id)): {"title": "Test"},
            ("POST", _station("pins", bad_id)): {"pinnable_type": "item", "pinnable_id": "00000000-0000-0000-0000-000000000000"},
            ("POST", _station("tags", bad_id)): {"name": "test"},
        }
        for method, path in endpoints:
            if method == "GET":
                resp = client.get(path, headers=_headers())
            else:
                resp = client.post(path, json=bodies.get((method, path), {}), headers=_headers())
            assert resp.status_code == 404, f"{method} {path} expected 404, got {resp.status_code}"
