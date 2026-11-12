"""Decorador `permission_required` y cache por request (rbac-access-control, etapa 4 — rojo).

Contrato (`app.rbac.security`):
- `permission_required(*perms)`: envuelve `login_required`; exige TODOS los permisos (AND, P6);
  superusuario pasa; inactivo -> 401 aunque sea superusuario (P10);
  falta un permiso -> 403 {"error": "Acceso denegado: permisos insuficientes", "code": "FORBIDDEN"}.
- `get_user_permissions() -> frozenset[str]`: permisos del usuario actual, cacheados en `flask.g`
  (mismo objeto dentro de un request, recalculado en el siguiente). Superusuario -> catálogo completo.
"""

from app.rbac.constants import Perm

FORBIDDEN_BODY = {"error": "Acceso denegado: permisos insuficientes", "code": "FORBIDDEN"}
ALL_CODES = sorted(p.value for p in Perm)


def _reader(rbac, username="ana"):
    rbac.sync_catalog()
    user_id = rbac.user(username)
    group_id = rbac.group("Taller", [rbac.role("Lector", [Perm.ORDERS_READ])])
    rbac.add_member(user_id, group_id)
    return user_id, group_id


# --- casos mínimos del usuario ---------------------------------------------------------


def test_allows_permission_via_group(guarded_client, rbac):
    ana, _ = _reader(rbac)
    resp = guarded_client.get("/_test/rbac/orders-read", headers=rbac.headers(ana))
    assert resp.status_code == 200


def test_allows_permission_via_direct_role(guarded_client, rbac):
    rbac.sync_catalog()
    ana = rbac.user("ana")
    rbac.assign_direct(ana, rbac.role("Lector", [Perm.ORDERS_READ]))

    resp = guarded_client.get("/_test/rbac/orders-read", headers=rbac.headers(ana))
    assert resp.status_code == 200


def test_union_group_plus_direct_satisfies_and(guarded_client, rbac):
    ana, _ = _reader(rbac)  # orders:read por grupo
    rbac.assign_direct(ana, rbac.role("Borrador", [Perm.ORDERS_DELETE]))  # orders:delete directo

    resp = guarded_client.get("/_test/rbac/orders-read-and-delete", headers=rbac.headers(ana))
    assert resp.status_code == 200


def test_user_in_two_groups_combines_permissions(guarded_client, rbac):
    rbac.sync_catalog()
    ana = rbac.user("ana")
    rbac.add_member(ana, rbac.group("Pedidos", [rbac.role("R1", [Perm.ORDERS_READ])]))
    rbac.add_member(ana, rbac.group("Admin pedidos", [rbac.role("R2", [Perm.ORDERS_DELETE])]))

    resp = guarded_client.get("/_test/rbac/orders-read-and-delete", headers=rbac.headers(ana))
    assert resp.status_code == 200


def test_user_without_permission_gets_403_forbidden(guarded_client, rbac):
    rbac.sync_catalog()
    beto = rbac.user("beto")

    resp = guarded_client.get("/_test/rbac/orders-read", headers=rbac.headers(beto))
    assert resp.status_code == 403
    assert resp.get_json() == FORBIDDEN_BODY


def test_without_token_gets_401(guarded_client):
    resp = guarded_client.get("/_test/rbac/orders-read")
    assert resp.status_code == 401


def test_superuser_passes_without_any_role(guarded_client, rbac):
    rbac.sync_catalog()
    jefa = rbac.user("jefa", is_superuser=True)

    resp = guarded_client.get("/_test/rbac/orders-read-and-delete", headers=rbac.headers(jefa))
    assert resp.status_code == 200


# --- P6 / P10 --------------------------------------------------------------------------


def test_requires_all_permissions_and(guarded_client, rbac):
    ana, _ = _reader(rbac)  # solo orders:read

    resp = guarded_client.get("/_test/rbac/orders-read-and-delete", headers=rbac.headers(ana))
    assert resp.status_code == 403
    assert resp.get_json() == FORBIDDEN_BODY


def test_inactive_superuser_gets_401(guarded_client, rbac):
    rbac.sync_catalog()
    jefa = rbac.user("jefa", is_superuser=True, is_active=False)

    resp = guarded_client.get("/_test/rbac/orders-read", headers=rbac.headers(jefa))
    assert resp.status_code == 401


def test_inactive_user_with_permission_gets_401(guarded_client, rbac):
    rbac.sync_catalog()
    ana = rbac.user("ana", is_active=False)
    rbac.add_member(ana, rbac.group("Taller", [rbac.role("Lector", [Perm.ORDERS_READ])]))

    resp = guarded_client.get("/_test/rbac/orders-read", headers=rbac.headers(ana))
    assert resp.status_code == 401


# --- cache por request -----------------------------------------------------------------


def test_permissions_are_cached_within_a_request(guarded_client, rbac):
    ana, _ = _reader(rbac)

    resp = guarded_client.get("/_test/rbac/cache-probe", headers=rbac.headers(ana))
    assert resp.status_code == 200
    assert resp.get_json() == {"same_object": True, "permissions": ["orders:read"]}


def test_revoked_permission_applies_on_next_request(guarded_client, rbac):
    ana, group_id = _reader(rbac)
    headers = rbac.headers(ana)
    assert guarded_client.get("/_test/rbac/orders-read", headers=headers).status_code == 200

    rbac.remove_member(ana, group_id)

    resp = guarded_client.get("/_test/rbac/orders-read", headers=headers)
    assert resp.status_code == 403


def test_cache_does_not_leak_between_users(guarded_client, rbac):
    ana, _ = _reader(rbac)
    beto = rbac.user("beto")

    assert guarded_client.get("/_test/rbac/orders-read", headers=rbac.headers(ana)).status_code == 200
    resp = guarded_client.get("/_test/rbac/orders-read", headers=rbac.headers(beto))
    assert resp.status_code == 403

    probe = guarded_client.get("/_test/rbac/cache-probe", headers=rbac.headers(beto))
    assert probe.get_json()["permissions"] == []


def test_superuser_permissions_are_the_full_catalog(guarded_client, rbac):
    rbac.sync_catalog()
    jefa = rbac.user("jefa", is_superuser=True)

    resp = guarded_client.get("/_test/rbac/cache-probe", headers=rbac.headers(jefa))
    assert resp.get_json()["permissions"] == ALL_CODES
