"""Rutas del taller protegidas con `permission_required` (rbac-access-control, etapa 5).

Para cada endpoint: sin permiso -> 403 FORBIDDEN; con EXACTAMENTE su permiso -> no es
401/403 (puede ser 404/422 porque se usan IDs inexistentes y bodies vacíos: lo que se prueba
es la autorización, no la lógica). Además, sin token -> 401.
"""

import pytest

from app.extensions import db
from app.rbac.constants import OPERATOR_GROUP_NAME, Perm
from app.rbac.models import Group
from app.rbac.services import seed_rbac

MISSING = 999999
FORBIDDEN_BODY = {"error": "Acceso denegado: permisos insuficientes", "code": "FORBIDDEN"}

ENDPOINTS = [
    ("POST", "/api/orders", Perm.ORDERS_CREATE),
    ("PUT", f"/api/orders/{MISSING}", Perm.ORDERS_UPDATE),
    ("GET", "/api/orders", Perm.ORDERS_READ),
    ("GET", f"/api/orders/{MISSING}", Perm.ORDERS_READ),
    ("GET", f"/api/orders/{MISSING}/history", Perm.ORDERS_READ),
    ("POST", f"/api/orders/{MISSING}/quote", Perm.ORDERS_QUOTE),
    ("POST", f"/api/orders/{MISSING}/quote/confirm", Perm.ORDERS_QUOTE),
    ("POST", f"/api/orders/{MISSING}/approve", Perm.ORDERS_APPROVE),
    ("POST", f"/api/orders/{MISSING}/start-printing", Perm.ORDERS_PRODUCE),
    ("POST", f"/api/orders/{MISSING}/mark-ready", Perm.ORDERS_PRODUCE),
    ("POST", f"/api/orders/{MISSING}/deliver", Perm.ORDERS_DELIVER),
    ("DELETE", f"/api/orders/{MISSING}", Perm.ORDERS_DELETE),
    ("GET", "/api/cashbox/summary", Perm.CASH_MOVEMENTS_READ),
    ("GET", "/api/cashbox/movements", Perm.CASH_MOVEMENTS_READ),
    ("GET", f"/api/cashbox/orders/{MISSING}/balance", Perm.CASH_MOVEMENTS_READ),
    ("POST", "/api/cashbox/movements", Perm.CASH_MOVEMENTS_CREATE),
    ("POST", f"/api/cashbox/orders/{MISSING}/collect-balance", Perm.CASH_MOVEMENTS_CREATE),
    ("GET", "/api/cashbox/categories/income", Perm.CASH_CATEGORIES_READ),
    ("GET", "/api/cashbox/categories/expense", Perm.CASH_CATEGORIES_READ),
    ("POST", "/api/cashbox/categories/income", Perm.CASH_CATEGORIES_CREATE),
    ("POST", "/api/cashbox/categories/expense", Perm.CASH_CATEGORIES_CREATE),
    ("PUT", f"/api/cashbox/categories/income/{MISSING}", Perm.CASH_CATEGORIES_UPDATE),
    ("PUT", f"/api/cashbox/categories/expense/{MISSING}", Perm.CASH_CATEGORIES_UPDATE),
    ("GET", "/api/printers", Perm.PRINTERS_READ),
    ("POST", "/api/printers", Perm.PRINTERS_CREATE),
    ("PUT", f"/api/printers/{MISSING}", Perm.PRINTERS_UPDATE),
    ("GET", "/api/settings", Perm.SETTINGS_READ),
    ("PUT", "/api/settings", Perm.SETTINGS_UPDATE),
    ("GET", "/api/materials", Perm.MATERIALS_READ),
    ("GET", "/api/filaments", Perm.FILAMENTS_READ),
]
IDS = [f"{method} {path.replace(str(MISSING), '<id>')}" for method, path, _ in ENDPOINTS]


def _call(http_client, method, path, headers=None):
    body = {} if method in ("POST", "PUT") else None
    return http_client.open(path, method=method, json=body, headers=headers or {})


def test_every_workshop_endpoint_is_listed():
    assert len(ENDPOINTS) == 30
    assert {perm for _, _, perm in ENDPOINTS} == set(Perm) - {Perm.RBAC_READ, Perm.RBAC_MANAGE}


@pytest.mark.parametrize(("method", "path", "perm"), ENDPOINTS, ids=IDS)
def test_without_permission_gets_403(http_client, rbac, method, path, perm):
    rbac.sync_catalog()
    nadie = rbac.user("sin_permisos")

    resp = _call(http_client, method, path, rbac.headers(nadie))

    assert resp.status_code == 403
    assert resp.get_json() == FORBIDDEN_BODY


@pytest.mark.parametrize(("method", "path", "perm"), ENDPOINTS, ids=IDS)
def test_with_exactly_its_permission_is_authorized(http_client, rbac, method, path, perm):
    rbac.sync_catalog()
    ana = rbac.user("ana")
    rbac.assign_direct(ana, rbac.role("Solo uno", [perm]))

    resp = _call(http_client, method, path, rbac.headers(ana))

    assert resp.status_code not in (401, 403), resp.get_json()


@pytest.mark.parametrize(("method", "path", "perm"), ENDPOINTS, ids=IDS)
def test_without_token_gets_401(http_client, method, path, perm):
    assert _call(http_client, method, path).status_code == 401


# --- rol "Operador" sembrado ------------------------------------------------------------


@pytest.fixture
def operator_headers(app, rbac):
    with app.app_context():
        seed_rbac()
        group_id = Group.query.filter_by(name=OPERATOR_GROUP_NAME).one().id
        db.session.remove()
    operaria = rbac.user("operaria")
    rbac.add_member(operaria, group_id)
    return rbac.headers(operaria)


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("DELETE", f"/api/orders/{MISSING}"),
        ("PUT", "/api/settings"),
        ("POST", "/api/printers"),
        ("PUT", f"/api/printers/{MISSING}"),
        ("POST", "/api/cashbox/categories/income"),
        ("PUT", f"/api/cashbox/categories/expense/{MISSING}"),
    ],
)
def test_operator_cannot_delete_orders_or_change_configuration(http_client, operator_headers, method, path):
    assert _call(http_client, method, path, operator_headers).status_code == 403


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/orders"),
        ("GET", "/api/printers"),
        ("GET", "/api/settings"),
        ("GET", "/api/cashbox/summary"),
        ("GET", "/api/materials"),
        ("GET", "/api/filaments"),
    ],
)
def test_operator_can_read_what_the_daily_work_needs(http_client, operator_headers, method, path):
    assert _call(http_client, method, path, operator_headers).status_code == 200


def test_auth_me_only_needs_a_session(http_client, rbac):
    rbac.sync_catalog()
    nadie = rbac.user("sin_permisos")

    assert http_client.get("/api/auth/me", headers=rbac.headers(nadie)).status_code == 200
    assert http_client.get("/api/auth/me/permissions", headers=rbac.headers(nadie)).status_code == 200
