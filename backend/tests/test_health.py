from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "symptra-backend"


def test_root() -> None:
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    assert "Symptra" in response.json()["name"]
