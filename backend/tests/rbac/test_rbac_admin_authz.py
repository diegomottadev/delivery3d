"""Autorización del blueprint /api/rbac (etapa 6).

Toda ruta: sin token -> 401; sin permisos -> 403 FORBIDDEN (antes que 404/422).
Lecturas (incluidos los endpoints de impacto) -> `rbac:read`; escrituras -> `rbac:manage`.
"""

import pytest

from app.rbac.constants import Perm
from tests.rbac.admin_support import reader

M = 999999
FORBIDDEN_BODY = {"error": "Acceso denegado: permisos insuficientes", "code": "FORBIDDEN"}

READS = [
    ("GET", "/api/rbac/users"),
    ("GET", f"/api/rbac/users/{M}"),
    ("GET", f"/api/rbac/users/{M}/groups"),
    ("GET", f"/api/rbac/users/{M}/roles"),
    ("GET", f"/api/rbac/users/{M}/access"),
    ("GET", f"/api/rbac/users/{M}/roles/{M}/removal-impact"),
    ("GET", "/api/rbac/groups"),
    ("GET", f"/api/rbac/groups/{M}"),
    ("GET", f"/api/rbac/groups/{M}/members"),
    ("GET", f"/api/rbac/groups/{M}/roles"),
    ("GET", f"/api/rbac/groups/{M}/removal-impact"),
    ("GET", f"/api/rbac/groups/{M}/members/{M}/removal-impact"),
    ("GET", f"/api/rbac/groups/{M}/roles/{M}/removal-impact"),
    ("GET", "/api/rbac/roles"),
    ("GET", f"/api/rbac/roles/{M}"),
    ("GET", f"/api/rbac/roles/{M}/removal-impact"),
    ("POST", f"/api/rbac/roles/{M}/permissions/impact"),
    ("GET", "/api/rbac/permissions"),
]
WRITES = [
    ("POST", f"/api/rbac/users/{M}/groups"),
    ("DELETE", f"/api/rbac/users/{M}/groups/{M}"),
    ("POST", f"/api/rbac/users/{M}/roles"),
    ("DELETE", f"/api/rbac/users/{M}/roles/{M}"),
    ("POST", "/api/rbac/groups"),
    ("PUT", f"/api/rbac/groups/{M}"),
    ("DELETE", f"/api/rbac/groups/{M}"),
    ("POST", f"/api/rbac/groups/{M}/members"),
    ("DELETE", f"/api/rbac/groups/{M}/members/{M}"),
    ("POST", f"/api/rbac/groups/{M}/roles"),
    ("DELETE", f"/api/rbac/groups/{M}/roles/{M}"),
    ("POST", "/api/rbac/roles"),
    ("PUT", f"/api/rbac/roles/{M}"),
    ("DELETE", f"/api/rbac/roles/{M}"),
    ("PUT", f"/api/rbac/roles/{M}/permissions"),
]
ALL = READS + WRITES
IDS = [f"{m} {p.replace(str(M), '<id>')}" for m, p in ALL]


def _call(client, method, path, headers=None):
    body = {} if method in ("POST", "PUT") else None
    return client.open(path, method=method, json=body, headers=headers or {})


@pytest.mark.parametrize(("method", "path"), ALL, ids=IDS)
def test_without_token_is_401(http_client, method, path):
    assert _call(http_client, method, path).status_code == 401


@pytest.mark.parametrize(("method", "path"), ALL, ids=IDS)
def test_without_permissions_is_403(http_client, rbac, method, path):
    rbac.sync_catalog()
    nobody = rbac.user("nadie")
    resp = _call(http_client, method, path, rbac.headers(nobody))
    assert resp.status_code == 403
    assert resp.get_json() == FORBIDDEN_BODY


@pytest.mark.parametrize(("method", "path"), READS, ids=IDS[: len(READS)])
def test_reads_need_only_rbac_read(http_client, rbac, method, path):
    rbac.sync_catalog()
    lector = reader(rbac)
    assert _call(http_client, method, path, lector.headers).status_code not in (401, 403)


@pytest.mark.parametrize(("method", "path"), WRITES, ids=IDS[len(READS):])
def test_writes_need_rbac_manage(http_client, rbac, method, path):
    rbac.sync_catalog()
    lector = reader(rbac)
    assert _call(http_client, method, path, lector.headers).status_code == 403

    manager = rbac.user("gestor")
    rbac.add_member(manager, rbac.group("Gestores", [rbac.role("Gestor", [Perm.RBAC_MANAGE])]))
    assert _call(http_client, method, path, rbac.headers(manager)).status_code not in (401, 403)
