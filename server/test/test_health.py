from server.test.conftest import get_client


def test_health():
    client = next(get_client())
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
