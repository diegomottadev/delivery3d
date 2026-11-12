from datetime import datetime, timedelta, timezone

import jwt

from app.auth.models import User
from app.extensions import db


class TestAuthAndSecurity:
    def test_login_success(self, http_client):
        resp = http_client.post(
            "/api/auth/login",
            json={"username": "operador", "password": "operador123"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["username"] == "operador"
        assert data["user"]["role"] == "admin"
        assert "password_hash" not in data["user"]
        assert data["expires_in"] == 86400

    def test_login_invalid_password_returns_generic_error(self, http_client):
        resp = http_client.post(
            "/api/auth/login",
            json={"username": "operador", "password": "wrongpassword"},
        )
        assert resp.status_code == 401
        data = resp.get_json()
        assert data["error"] == "Credenciales inválidas"

    def test_login_nonexistent_user_returns_same_generic_error(self, http_client):
        resp = http_client.post(
            "/api/auth/login",
            json={"username": "no_existe", "password": "anypassword"},
        )
        assert resp.status_code == 401
        data = resp.get_json()
        # Prevents User Enumeration / Username Harvesting (OWASP API2)
        assert data["error"] == "Credenciales inválidas"

    def test_login_inactive_user_rejected(self, http_client, app):
        with app.app_context():
            u = User(username="inactivo", role="operator", is_active=False)
            u.set_password("pass123")
            db.session.add(u)
            db.session.commit()

        resp = http_client.post(
            "/api/auth/login",
            json={"username": "inactivo", "password": "pass123"},
        )
        assert resp.status_code == 401
        data = resp.get_json()
        assert "inactivo" in data["error"].lower() or "inválidas" in data["error"].lower()

    def test_login_empty_payload_rejected(self, http_client):
        resp = http_client.post("/api/auth/login", json={})
        assert resp.status_code == 401
        data = resp.get_json()
        assert data["error"] == "Credenciales inválidas"

    def test_get_me_authenticated(self, http_client, auth_headers):
        resp = http_client.get("/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["username"] == "operador"
        assert "password_hash" not in data

    def test_get_me_unauthorized_without_token(self, http_client):
        resp = http_client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_expired_token_rejected(self, http_client, app):
        with app.app_context():
            expired_time = datetime.now(timezone.utc) - timedelta(hours=2)
            payload = {
                "sub": "1",
                "username": "operador",
                "role": "admin",
                "iss": "delivery3d-api",
                "iat": expired_time - timedelta(hours=24),
                "exp": expired_time,
            }
            token = jwt.encode(payload, app.config["JWT_SECRET_KEY"], algorithm="HS256")

        resp = http_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
        assert "inválido o expirado" in resp.get_json()["error"].lower()

    def test_invalid_signature_rejected(self, http_client, app):
        with app.app_context():
            payload = {"sub": "1", "exp": datetime.now(timezone.utc) + timedelta(hours=1)}
            token = jwt.encode(payload, "wrong-secret-key", algorithm="HS256")

        resp = http_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401

    def test_algorithm_none_rejected(self, http_client):
        # Craft an unsigned token to test algorithm confusion / none attack
        token = jwt.encode({"sub": "1"}, key="", algorithm="none")
        resp = http_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401

    def test_bopla_user_to_dict_never_exposes_password_hash(self, app):
        with app.app_context():
            user = User(username="test_bopla", role="operator")
            user.set_password("secreta123")
            d = user.to_dict()
            assert "password_hash" not in d
            assert "password" not in d
            assert d["username"] == "test_bopla"

    def test_security_headers_present_on_response(self, http_client):
        resp = http_client.get("/")
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("X-Frame-Options") == "DENY"
