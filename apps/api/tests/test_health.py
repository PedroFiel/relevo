from fastapi.testclient import TestClient
from relevo_api.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_health_db_responde_mesmo_sem_banco():
    r = client.get("/health/db")
    assert r.status_code == 200
    assert r.json()["banco"] in {"ok", "indisponivel"}
