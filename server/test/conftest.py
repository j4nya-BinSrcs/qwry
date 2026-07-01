from fastapi.testclient import TestClient
from server.src.main import app


def get_client():
    with TestClient(app) as c:
        yield c
