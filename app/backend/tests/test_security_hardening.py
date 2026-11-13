"""Regresiones de la revisión OWASP de backend/app/orders/routes.py y auth (2026-11-12)."""

import logging
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.auth.models import User
from app.extensions import db

ORDER_PAYLOAD = {
    "client": {"name": "Cliente OWASP", "origin": "whatsapp"},
    "items": [
        {
            "piece_description": "Pieza",
            "weight_g": "10.000",
            "print_time_minutes": 10,
            "quantity": 1,
        }
    ],
}


def _order_payload(material_id):
    payload = {**ORDER_PAYLOAD, "items": [{**ORDER_PAYLOAD["items"][0], "material_id": material_id}]}
    return payload


# --- A07: login_required valida los mismos claims que decode_jwt_token -------------------


class TestJwtClaims:
    def _token(self, app, **claims):
        with app.app_context():
            return jwt.encode(claims, app.config["JWT_SECRET_KEY"], algorithm="HS256")

    def test_token_without_exp_is_rejected(self, app, http_client):
        now = datetime.now(timezone.utc)
        token = self._token(app, sub="1", iss="delivery3d-api", iat=now)
        resp = http_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401

    def test_token_with_wrong_issuer_is_rejected(self, app, http_client):
        now = datetime.now(timezone.utc)
        token = self._token(app, sub="1", iss="otro-sistema", iat=now, exp=now + timedelta(hours=1))
        resp = http_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401

    def test_token_issued_by_login_is_accepted(self, http_client):
        login = http_client.post("/api/auth/login", json={"username": "operador", "password": "operador123"})
        token = login.get_json()["token"]
        resp = http_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200


# --- A10: cuerpos JSON que no son objeto -> 422, no 500 ----------------------------------


class TestNonObjectJsonBody:
    @pytest.mark.parametrize("body", [[1], "texto", 5])
    def test_create_order_rejects_non_object_body(self, http_client, auth_headers, body):
        resp = http_client.post("/api/orders", json=body, headers=auth_headers)
        assert resp.status_code == 422

    def test_update_order_rejects_non_object_body(self, http_client, auth_headers):
        resp = http_client.put("/api/orders/1", json=[1], headers=auth_headers)
        assert resp.status_code == 422

    def test_quote_rejects_non_object_quote_vars(self, http_client, auth_headers, material):
        order_id = http_client.post("/api/orders", json=_order_payload(material), headers=auth_headers).json["id"]
        resp = http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": "x"}, headers=auth_headers)
        assert resp.status_code == 422

    def test_cashbox_movement_rejects_non_object_body(self, http_client, auth_headers):
        resp = http_client.post("/api/cashbox/movements", json=[1], headers=auth_headers)
        assert resp.status_code == 422

    def test_settings_rejects_non_object_body(self, http_client, auth_headers):
        resp = http_client.put("/api/settings", json=[1], headers=auth_headers)
        assert resp.status_code == 422

    def test_printers_rejects_non_object_body(self, http_client, auth_headers):
        resp = http_client.post("/api/printers", json=[1], headers=auth_headers)
        assert resp.status_code == 422

    def test_login_rejects_non_object_body(self, http_client):
        resp = http_client.post("/api/auth/login", json=[1])
        assert resp.status_code == 422


# --- A09: borrado de pedidos auditado ------------------------------------------------------


def test_delete_order_logs_audit_entry_with_user(http_client, auth_headers, material, caplog):
    order_id = http_client.post("/api/orders", json=_order_payload(material), headers=auth_headers).json["id"]

    with caplog.at_level(logging.INFO, logger="delivery3d.audit"):
        resp = http_client.delete(f"/api/orders/{order_id}", headers=auth_headers)

    assert resp.status_code == 200
    records = [r for r in caplog.records if r.name == "delivery3d.audit"]
    assert len(records) == 1
    msg = records[0].getMessage()
    assert "order_deleted" in msg
    assert f"order_id={order_id}" in msg
    assert "user_id=1" in msg
    assert "status=nuevo" in msg


# --- A06: listado de pedidos paginado ----------------------------------------------------


class TestOrderListPagination:
    def _create(self, http_client, auth_headers, material, n):
        for _ in range(n):
            http_client.post("/api/orders", json=_order_payload(material), headers=auth_headers)

    def test_limit_and_offset(self, http_client, auth_headers, material):
        self._create(http_client, auth_headers, material, 3)
        resp = http_client.get("/api/orders?limit=2&offset=0", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.get_json()) == 2
        assert resp.headers["X-Total-Count"] == "3"

        resp2 = http_client.get("/api/orders?limit=2&offset=2", headers=auth_headers)
        assert len(resp2.get_json()) == 1

    def test_default_returns_list_with_total(self, http_client, auth_headers, material):
        self._create(http_client, auth_headers, material, 2)
        resp = http_client.get("/api/orders", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.get_json()) == 2
        assert resp.headers["X-Total-Count"] == "2"

    @pytest.mark.parametrize("query", ["limit=0", "limit=501", "limit=abc", "offset=-1"])
    def test_invalid_pagination_params(self, http_client, auth_headers, query):
        resp = http_client.get(f"/api/orders?{query}", headers=auth_headers)
        assert resp.status_code == 422


# --- A10: errores de dominio con excepción propia ----------------------------------------


def test_create_order_with_unknown_client_id_returns_422(http_client, auth_headers, material):
    payload = {"client_id": 999999, "items": _order_payload(material)["items"]}
    resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
    assert resp.status_code == 422
    assert "999999" in resp.get_json()["error"]


def test_client_not_found_is_domain_exception():
    from app.orders.services import ClientNotFoundError

    assert not issubclass(ClientNotFoundError, ValueError)


# --- A10: 500 genérico, sin filtrar detalles internos -------------------------------------


def test_unhandled_error_returns_generic_500(app, http_client, monkeypatch):
    import app.auth.routes as auth_routes

    def boom(**_kwargs):
        raise RuntimeError("detalle interno: pymysql host=10.0.0.5")

    monkeypatch.setattr(auth_routes, "authenticate_user", boom)
    monkeypatch.setitem(app.config, "PROPAGATE_EXCEPTIONS", False)

    resp = http_client.post("/api/auth/login", json={"username": "operador", "password": "x"})

    assert resp.status_code == 500
    assert resp.is_json
    assert "pymysql" not in resp.get_data(as_text=True)
    assert "detalle interno" not in resp.get_data(as_text=True)


# --- A07: login no revela usuarios inactivos sin la contraseña correcta ------------------


def test_inactive_user_with_wrong_password_gets_generic_error(app, http_client):
    with app.app_context():
        u = User(username="inactivo2", role="operator", is_active=False)
        u.set_password("correcta-123")
        db.session.add(u)
        db.session.commit()

    resp = http_client.post("/api/auth/login", json={"username": "inactivo2", "password": "incorrecta"})
    assert resp.status_code == 401
    assert resp.get_json()["error"] == "Credenciales inválidas"


# --- A07/A06: límite de intentos de login ------------------------------------------------


class TestLoginRateLimit:
    def _fail(self, http_client, username="operador"):
        return http_client.post("/api/auth/login", json={"username": username, "password": "mala"})

    def test_blocks_after_five_failed_attempts(self, http_client):
        for _ in range(5):
            assert self._fail(http_client).status_code == 401
        blocked = self._fail(http_client)
        assert blocked.status_code == 429
        assert "Retry-After" in blocked.headers

    def test_blocked_even_with_correct_password(self, http_client):
        for _ in range(5):
            self._fail(http_client)
        resp = http_client.post("/api/auth/login", json={"username": "operador", "password": "operador123"})
        assert resp.status_code == 429

    def test_successful_login_resets_counter(self, http_client):
        for _ in range(4):
            self._fail(http_client)
        ok = http_client.post("/api/auth/login", json={"username": "operador", "password": "operador123"})
        assert ok.status_code == 200
        for _ in range(4):
            assert self._fail(http_client).status_code == 401

    def test_limit_is_per_username(self, http_client):
        for _ in range(5):
            self._fail(http_client, "operador")
        assert self._fail(http_client, "otro_usuario").status_code == 401
