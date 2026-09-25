import os
os.environ["DATABASE_URL"] = "sqlite:///./test_site_assignment.db"
os.environ["AUTH_MODE"] = "dev"
os.environ["DEV_USER_EMAIL"] = "supervisor@example.com"
os.environ["BOOTSTRAP_SUPERVISORS"] = "supervisor@example.com"

from fastapi.testclient import TestClient
from app.db import Base, engine
from app.main import app

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
client = TestClient(app)

def test_shared_state_revision_and_conflict():
    initial = client.get("/api/v1/state")
    assert initial.status_code == 200
    assert initial.json()["revision"] == 0

    first = client.put("/api/v1/state", json={"expected_revision":0,"payload":{"version":10,"sites":[]},"note":"bootstrap"})
    assert first.status_code == 200
    assert first.json()["revision"] == 1

    stale = client.put("/api/v1/state", json={"expected_revision":0,"payload":{"version":10,"sites":["stale"]}})
    assert stale.status_code == 409

    history = client.get("/api/v1/state/history")
    assert history.status_code == 200
    assert history.json()[0]["revision"] == 1
    assert history.json()[0]["actor"] == "supervisor@example.com"
