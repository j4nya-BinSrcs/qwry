import pytest
from fastapi.testclient import TestClient
from server.src.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _clean_db(client):
    yield
    resp = client.get("/api/workspaces", headers={"X-Session-Id": "cleanup"})
    if resp.status_code == 200:
        for ws in resp.json():
            client.delete(f"/api/workspaces/{ws['id']}", headers={"X-Session-Id": "cleanup"})
    resp = client.get("/api/workspaces", headers={"X-Session-Id": "test-session-123"})
    if resp.status_code == 200:
        for ws in resp.json():
            client.delete(f"/api/workspaces/{ws['id']}", headers={"X-Session-Id": "test-session-123"})
