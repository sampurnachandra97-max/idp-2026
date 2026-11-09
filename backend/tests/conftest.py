import os

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def anon(tmp_path, monkeypatch):
    """A signed-out client with its own empty database."""
    monkeypatch.setenv("SOIL_DB_PATH", str(tmp_path / "test.db"))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    """A signed-in client shared by the analysis tests."""
    previous = os.environ.get("SOIL_DB_PATH")
    os.environ["SOIL_DB_PATH"] = str(tmp_path_factory.mktemp("db") / "test.db")
    with TestClient(app) as test_client:
        response = test_client.post(
            "/api/auth/signup",
            json={"name": "Test Farmer", "email": "farmer@example.com", "password": "correct-horse"},
        )
        assert response.status_code == 201
        yield test_client
    if previous is None:
        del os.environ["SOIL_DB_PATH"]
    else:
        os.environ["SOIL_DB_PATH"] = previous
