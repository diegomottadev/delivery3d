"""Administración de roles y sus permisos (api-contract.md §4). Etapa 6."""

from app.rbac.constants import Perm
from app.rbac.models import Role, RolePermission
from tests.rbac.admin_support import SELF_ASSIGNMENT_BODY, assert_error, count, fetch, setup_admin

BASE = "/api/rbac/roles"
DETAIL_KEYS = {"id", "name", "description", "created_at", "updated_at", "permissions"}


def test_create_role(http_client, rbac, app):
    admin = setup_admin(rbac)

    resp = http_client.post(
        BASE, json={"name": " Encargado ", "description": "Encargado del taller", "updated_by": 7},
        headers=admin.headers,
    )

    assert resp.status_code == 201
    body = resp.get_json()
    assert set(body) == DETAIL_KEYS
    assert body["name"] == "Encargado"
    assert body["permissions"] == []
    row = fetch(app, Role, id=body["id"])
    assert row["created_by"] == admin.id and row["updated_by"] == admin.id


def test_create_role_validation_and_name_taken(http_client, rbac):
    admin = setup_admin(rbac)

    body = assert_error(http_client.post(BASE, json={"name": ""}, headers=admin.headers), 422, "VALIDATION_ERROR")
    assert "name" in body["errors"]
    assert_error(http_client.post(BASE, json={"name": "admin SEGURIDAD"}, headers=admin.headers), 409, "NAME_TAKEN")


def test_list_roles_with_counts_and_filter(http_client, rbac):
    admin = setup_admin(rbac)
    role = rbac.role("Operador", [Perm.ORDERS_READ, Perm.ORDERS_CREATE])
    rbac.group("Operadores", [role])
    rbac.group("Turno noche", [role])
    rbac.assign_direct(rbac.user("ana"), role)

    resp = http_client.get(BASE, headers=admin.headers)

    assert resp.status_code == 200
    by_name = {r["name"]: r for r in resp.get_json()}
    assert by_name["Operador"] == {
        "id": role, "name": "Operador", "description": None,
        "permissions_count": 2, "groups_count": 2, "direct_users_count": 1,
    }
    assert [r["name"] for r in resp.get_json()] == sorted(by_name)
    assert [r["name"] for r in http_client.get(f"{BASE}?q=opera", headers=admin.headers).get_json()] == ["Operador"]


def test_get_role_detail_with_sorted_permissions(http_client, rbac):
    admin = setup_admin(rbac)
    role = rbac.role("Operador", [Perm.PRINTERS_READ, Perm.ORDERS_READ])

    resp = http_client.get(f"{BASE}/{role}", headers=admin.headers)

    assert resp.status_code == 200
    assert resp.get_json()["permissions"] == ["orders:read", "printers:read"]
    assert_error(http_client.get(f"{BASE}/999999", headers=admin.headers), 404, "NOT_FOUND")


def test_update_role(http_client, rbac, app):
    admin = setup_admin(rbac)
    role = rbac.role("Operador", [Perm.ORDERS_READ])

    resp = http_client.put(f"{BASE}/{role}", json={"name": "Operario", "description": "x"}, headers=admin.headers)

    assert resp.status_code == 200
    assert resp.get_json()["name"] == "Operario"
    assert resp.get_json()["permissions"] == ["orders:read"]
    assert fetch(app, Role, id=role)["updated_by"] == admin.id
    assert_error(http_client.put(f"{BASE}/{role}", json={"name": "Admin seguridad"}, headers=admin.headers),
                 409, "NAME_TAKEN")


def test_delete_unused_role_cascades_permissions(http_client, rbac, app):
    admin = setup_admin(rbac)
    role = rbac.role("Temporal", [Perm.ORDERS_READ])

    assert http_client.delete(f"{BASE}/{role}", headers=admin.headers).status_code == 204
    assert count(app, Role, id=role) == 0
    assert count(app, RolePermission, role_id=role) == 0
    assert_error(http_client.delete(f"{BASE}/{role}", headers=admin.headers), 404, "NOT_FOUND")


def test_delete_role_in_use_is_409(http_client, rbac, app):
    admin = setup_admin(rbac)
    by_group = rbac.role("En grupo", [Perm.ORDERS_READ])
    rbac.group("Taller", [by_group])
    direct = rbac.role("Directo", [Perm.ORDERS_READ])
    rbac.assign_direct(rbac.user("ana"), direct)

    for role in (by_group, direct):
        assert_error(http_client.delete(f"{BASE}/{role}", headers=admin.headers), 409, "ROLE_IN_USE")
        assert count(app, Role, id=role) == 1


# --- PUT /roles/{id}/permissions --------------------------------------------------------


def test_replace_permissions(http_client, rbac, app):
    admin = setup_admin(rbac)
    role = rbac.role("Operador", [Perm.ORDERS_READ, Perm.ORDERS_DELETE])

    resp = http_client.put(
        f"{BASE}/{role}/permissions",
        json={"permissions": ["printers:read", "orders:read", "printers:read"]},
        headers=admin.headers,
    )

    assert resp.status_code == 200
    body = resp.get_json()
    assert set(body) == DETAIL_KEYS
    assert body["permissions"] == ["orders:read", "printers:read"]
    assert count(app, RolePermission, role_id=role) == 2
    assert fetch(app, Role, id=role)["updated_by"] == admin.id


def test_replace_permissions_with_empty_list(http_client, rbac):
    admin = setup_admin(rbac)
    role = rbac.role("Operador", [Perm.ORDERS_READ])

    resp = http_client.put(f"{BASE}/{role}/permissions", json={"permissions": []}, headers=admin.headers)
    assert resp.status_code == 200
    assert resp.get_json()["permissions"] == []


def test_replace_permissions_unknown_code(http_client, rbac, app):
    admin = setup_admin(rbac)
    role = rbac.role("Operador", [Perm.ORDERS_READ])

    resp = http_client.put(
        f"{BASE}/{role}/permissions", json={"permissions": ["orders:read", "orders:*"]}, headers=admin.headers
    )

    body = assert_error(resp, 422, "UNKNOWN_PERMISSION")
    assert "orders:*" in body["errors"]["permissions"]
    assert count(app, RolePermission, role_id=role) == 1


def test_replace_permissions_invalid_body(http_client, rbac):
    admin = setup_admin(rbac)
    role = rbac.role("Operador", [Perm.ORDERS_READ])

    for bad in ({}, {"permissions": "orders:read"}, {"permissions": [1]}):
        body = assert_error(http_client.put(f"{BASE}/{role}/permissions", json=bad, headers=admin.headers),
                            422, "VALIDATION_ERROR")
        assert "permissions" in body["errors"]
    assert_error(http_client.put(f"{BASE}/999999/permissions", json={}, headers=admin.headers), 404, "NOT_FOUND")


def test_adding_permissions_to_own_role_is_self_assignment(http_client, rbac, app):
    admin = setup_admin(rbac)

    resp = http_client.put(
        f"{BASE}/{admin.role_id}/permissions",
        json={"permissions": ["rbac:read", "rbac:manage", "orders:delete"]},
        headers=admin.headers,
    )

    assert resp.status_code == 409
    assert resp.get_json() == SELF_ASSIGNMENT_BODY
    assert count(app, RolePermission, role_id=admin.role_id) == 2


def test_adding_permissions_to_role_held_directly_is_self_assignment(http_client, rbac):
    admin = setup_admin(rbac)
    role = rbac.role("Auditor", [Perm.CASH_MOVEMENTS_READ])
    rbac.assign_direct(admin.id, role)

    resp = http_client.put(
        f"{BASE}/{role}/permissions", json={"permissions": ["cash_movements:read", "orders:read"]},
        headers=admin.headers,
    )
    assert_error(resp, 409, "SELF_ASSIGNMENT")


def test_removing_permissions_from_own_role_is_allowed(http_client, rbac):
    admin = setup_admin(rbac)

    resp = http_client.put(
        f"{BASE}/{admin.role_id}/permissions", json={"permissions": ["rbac:manage"]}, headers=admin.headers
    )
    assert resp.status_code == 200
    assert resp.get_json()["permissions"] == ["rbac:manage"]


def test_removing_manage_from_own_role_is_self_lockout(http_client, rbac, app):
    admin = setup_admin(rbac)

    resp = http_client.put(
        f"{BASE}/{admin.role_id}/permissions", json={"permissions": ["rbac:read"]}, headers=admin.headers
    )

    assert_error(resp, 409, "SELF_LOCKOUT")
    assert count(app, RolePermission, role_id=admin.role_id) == 2


def test_superuser_can_add_permissions_to_any_role(http_client, rbac, auth_headers):
    admin = setup_admin(rbac)
    resp = http_client.put(
        f"{BASE}/{admin.role_id}/permissions",
        json={"permissions": ["rbac:read", "rbac:manage", "orders:delete"]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
