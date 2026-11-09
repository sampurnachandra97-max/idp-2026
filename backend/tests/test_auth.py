import sqlite3

import pytest

USER = {"name": "Asha", "email": "asha@example.com", "password": "correct-horse"}
LOGIN = {"email": USER["email"], "password": USER["password"]}
SAMPLE = {
    "pH": 6.78, "EC": 0.25, "N": 179, "P": 7.93, "K": 256,
    "temperature": 25, "humidity": 80, "rainfall": 200,
}


def test_health_reports_a_working_service(anon):
    response = anon.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok", "models": "ok"}


def test_health_reports_a_broken_database(anon, monkeypatch):
    monkeypatch.setattr(anon.app.state.auth, "is_healthy", lambda: False)
    response = anon.get("/api/health")
    assert response.status_code == 503
    assert response.json()["status"] == "degraded"


def test_unexpected_errors_stay_private():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app, raise_server_exceptions=False) as client:
        original = app.state.auth.authenticate

        def explode(*_):
            raise RuntimeError("secret internal detail")

        app.state.auth.email_exists = lambda _: True
        app.state.auth.authenticate = explode
        response = client.post("/api/auth/login", json=LOGIN)
        app.state.auth.authenticate = original
    assert response.status_code == 500
    assert "secret" not in response.text
    assert response.json()["detail"] == "Something went wrong. Please try again."


def test_signup_signs_the_user_in(anon):
    response = anon.post("/api/auth/signup", json=USER)
    assert response.status_code == 201
    assert "password" not in response.text
    assert anon.get("/api/auth/me").json()["email"] == USER["email"]


def test_session_cookie_is_http_only(anon):
    cookie = anon.post("/api/auth/signup", json=USER).headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie


def test_password_and_token_are_not_stored_in_plain_text(anon):
    anon.post("/api/auth/signup", json=USER)
    token = anon.cookies["si_session"]
    connection = sqlite3.connect(anon.app.state.auth.path)
    dump = "\n".join(connection.iterdump())
    connection.close()
    assert USER["password"] not in dump and token not in dump


def test_email_is_unique_regardless_of_case(anon):
    anon.post("/api/auth/signup", json=USER)
    response = anon.post("/api/auth/signup", json={**USER, "email": "ASHA@example.com"})
    assert response.status_code == 409


@pytest.mark.parametrize(
    "change", [{"password": "short"}, {"email": "not-an-email"}, {"name": "   "}]
)
def test_invalid_signup_is_rejected(anon, change):
    assert anon.post("/api/auth/signup", json={**USER, **change}).status_code == 422


def test_login_and_logout(anon):
    anon.post("/api/auth/signup", json=USER)
    anon.post("/api/auth/logout")
    assert anon.get("/api/auth/me").status_code == 401
    assert anon.post("/api/auth/login", json=LOGIN).status_code == 200
    assert anon.get("/api/auth/me").status_code == 200


def test_logout_invalidates_a_copied_token(anon):
    anon.post("/api/auth/signup", json=USER)
    token = anon.cookies["si_session"]
    anon.post("/api/auth/logout")
    anon.cookies.set("si_session", token)
    assert anon.get("/api/auth/me").status_code == 401


def test_new_email_at_sign_in_starts_an_account(anon):
    response = anon.post("/api/auth/login", json={"email": "ravi.kumar@example.com", "password": "any-password"})
    assert response.status_code == 200
    assert response.json()["name"] == "Ravi Kumar"
    assert anon.get("/api/auth/me").json()["email"] == "ravi.kumar@example.com"


def test_new_email_at_sign_in_needs_a_long_enough_password(anon):
    response = anon.post("/api/auth/login", json={"email": "new@example.com", "password": "short"})
    assert response.status_code == 400
    assert anon.get("/api/auth/me").status_code == 401


def test_existing_account_still_requires_its_own_password(anon):
    anon.post("/api/auth/signup", json=USER)
    anon.post("/api/auth/logout")
    response = anon.post("/api/auth/login", json={**LOGIN, "password": "wrong-password"})
    assert response.status_code == 401
    assert anon.get("/api/auth/me").status_code == 401


def test_repeated_failures_are_locked_out(anon):
    anon.post("/api/auth/signup", json=USER)
    anon.post("/api/auth/logout")
    for _ in range(10):
        anon.post("/api/auth/login", json={**LOGIN, "password": "wrong-password"})
    assert anon.post("/api/auth/login", json=LOGIN).status_code == 429


@pytest.mark.parametrize(
    "method,path,body",
    [("post", "/api/analyze", SAMPLE), ("get", "/api/model-card", None)],
)
def test_data_endpoints_require_sign_in(anon, method, path, body):
    response = anon.request(method, path, json=body)
    assert response.status_code == 401
