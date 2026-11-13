"""Usuarios: listado, grupos, roles directos y acceso efectivo (api-contract.md §2). Etapa 6."""

from app.auth.models import User
from app.rbac.constants import Perm
from app.rbac.models import UserGroup, UserRole
from tests.rbac.admin_support import (
    ADMIN_GROUP,
    ADMIN_ROLE,
    SELF_ASSIGNMENT_BODY,
    assert_error,
    count,
    fetch,
    reader,
    setup_admin,
)

BASE = "/api/rbac/users"


# --- listado y detalle ------------------------------------------------------------------


def test_list_users_with_counts(http_client, rbac):
    admin = setup_admin(rbac)
    ana = rbac.user("Ana")
    rbac.add_member(ana, rbac.group("Taller"))
    rbac.assign_direct(ana, rbac.role("Auditor", [Perm.CASH_MOVEMENTS_READ]))

    resp = http_client.get(BASE, headers=admin.headers)

    assert resp.status_code == 200
    users = resp.get_json()
    assert [u["username"] for u in users] == ["admin", "Ana", "operador"]
    assert users[1] == {
        "id": ana, "username": "Ana", "is_active": True, "is_superuser": False,
        "groups_count": 1, "direct_roles_count": 1,
    }
    assert users[2]["is_superuser"] is True


def test_list_users_filter_is_case_insensitive_and_escapes_wildcards(http_client, rbac):
    admin = setup_admin(rbac)
    rbac.user("ana_maria")
    rbac.user("anabel")

    names = [u["username"] for u in http_client.get(f"{BASE}?q=ANA", headers=admin.headers).get_json()]
    assert names == ["ana_maria", "anabel"]
    names = [u["username"] for u in http_client.get(f"{BASE}?q=a_m", headers=admin.headers).get_json()]
    assert names == ["ana_maria"]
    names = [u["username"] for u in http_client.get(f"{BASE}?q=%25", headers=admin.headers).get_json()]
    assert names == []


def test_get_user_detail_never_exposes_password(http_client, rbac):
    admin = setup_admin(rbac)

    resp = http_client.get(f"{BASE}/{admin.id}", headers=admin.headers)

    assert resp.status_code == 200
    body = resp.get_json()
    assert set(body) == {"id", "username", "is_active", "is_superuser", "created_at", "updated_at"}
    assert body["username"] == "admin"
    assert_error(http_client.get(f"{BASE}/999999", headers=admin.headers), 404, "NOT_FOUND")


def test_is_superuser_cannot_be_changed_through_the_api(http_client, rbac, app):
    admin = setup_admin(rbac)
    ana = rbac.user("ana")
    group = rbac.group("Taller")

    for method in ("put", "patch"):
        assert getattr(http_client, method)(f"{BASE}/{ana}", json={"is_superuser": True},
                                            headers=admin.headers).status_code == 405
    http_client.post(f"{BASE}/{ana}/groups", json={"group_id": group, "is_superuser": True}, headers=admin.headers)
    assert fetch(app, User, id=ana)["is_superuser"] is False


# --- grupos del usuario -----------------------------------------------------------------


def test_user_groups_crud(http_client, rbac, app):
    admin = setup_admin(rbac)
    ana = rbac.user("ana")
    group = rbac.group("Taller")
    rbac.add_member(ana, rbac.group("Atención"))

    resp = http_client.post(f"{BASE}/{ana}/groups", json={"group_id": group}, headers=admin.headers)
    assert resp.status_code == 201
    assert resp.get_json() == {"user_id": ana, "group_id": group}
    assert fetch(app, UserGroup, user_id=ana, group_id=group)["created_by"] == admin.id

    listed = http_client.get(f"{BASE}/{ana}/groups", headers=admin.headers).get_json()
    assert [g["name"] for g in listed] == ["Atención", "Taller"]
    assert set(listed[0]) == {"id", "name", "description"}

    assert_error(http_client.post(f"{BASE}/{ana}/groups", json={"group_id": group}, headers=admin.headers),
                 409, "ALREADY_MEMBER")
    assert http_client.delete(f"{BASE}/{ana}/groups/{group}", headers=admin.headers).status_code == 204
    assert_error(http_client.delete(f"{BASE}/{ana}/groups/{group}", headers=admin.headers), 404, "NOT_FOUND")


def test_user_groups_not_found_and_validation(http_client, rbac):
    admin = setup_admin(rbac)
    ana = rbac.user("ana")

    assert_error(http_client.get(f"{BASE}/999999/groups", headers=admin.headers), 404, "NOT_FOUND")
    assert_error(http_client.post(f"{BASE}/999999/groups", json={}, headers=admin.headers), 404, "NOT_FOUND")
    body = assert_error(http_client.post(f"{BASE}/{ana}/groups", json={"group_id": "x"}, headers=admin.headers),
                        422, "VALIDATION_ERROR")
    assert "group_id" in body["errors"]
    assert_error(http_client.post(f"{BASE}/{ana}/groups", json={"group_id": 999999}, headers=admin.headers),
                 404, "NOT_FOUND")


def test_join_group_self_is_self_assignment(http_client, rbac, app):
    admin = setup_admin(rbac)
    group = rbac.group("Taller", [rbac.role("Borrador", [Perm.ORDERS_DELETE])])

    resp = http_client.post(f"{BASE}/{admin.id}/groups", json={"group_id": group}, headers=admin.headers)

    assert resp.status_code == 409
    assert resp.get_json() == SELF_ASSIGNMENT_BODY
    assert count(app, UserGroup, user_id=admin.id, group_id=group) == 0


def test_leave_admin_group_self_is_self_lockout(http_client, rbac):
    admin = setup_admin(rbac)
    resp = http_client.delete(f"{BASE}/{admin.id}/groups/{admin.group_id}", headers=admin.headers)
    assert_error(resp, 409, "SELF_LOCKOUT")


# --- roles directos ---------------------------------------------------------------------


def test_assign_direct_role(http_client, rbac, app):
    admin = setup_admin(rbac)
    ana = rbac.user("ana")
    role = rbac.role("Auditor", [Perm.CASH_MOVEMENTS_READ])

    resp = http_client.post(
        f"{BASE}/{ana}/roles",
        json={"role_id": role, "reason": "  Cubre auditoría de caja  ", "assigned_by": ana},
        headers=admin.headers,
    )

    assert resp.status_code == 201
    body = resp.get_json()
    row = fetch(app, UserRole, user_id=ana, role_id=role)
    assert body == {
        "id": row["id"],
        "role": {"id": role, "name": "Auditor"},
        "reason": "Cubre auditoría de caja",
        "assigned_by": {"id": admin.id, "username": "admin"},
        "assigned_at": row["assigned_at"].isoformat(),
    }
    assert row["assigned_by"] == admin.id and row["updated_by"] == admin.id

    listed = http_client.get(f"{BASE}/{ana}/roles", headers=admin.headers).get_json()
    assert listed == [body]


def test_direct_role_assigned_by_system_is_null(http_client, rbac, app):
    admin = setup_admin(rbac)
    ana = rbac.user("ana")
    role = rbac.role("Auditor", [Perm.CASH_MOVEMENTS_READ])
    with app.app_context():
        from app.extensions import db

        db.session.add(UserRole(user_id=ana, role_id=role, reason="seed", assigned_by=None))
        db.session.commit()
        db.session.remove()

    listed = http_client.get(f"{BASE}/{ana}/roles", headers=admin.headers).get_json()
    assert listed[0]["assigned_by"] is None


def test_assign_direct_role_reason_is_required(http_client, rbac, app):
    admin = setup_admin(rbac)
    ana = rbac.user("ana")
    role = rbac.role("Auditor", [Perm.CASH_MOVEMENTS_READ])

    for payload in ({"role_id": role}, {"role_id": role, "reason": "   "},
                    {"role_id": role, "reason": "x" * 256}, {"role_id": role, "reason": 3}):
        body = assert_error(http_client.post(f"{BASE}/{ana}/roles", json=payload, headers=admin.headers),
                            422, "VALIDATION_ERROR")
        assert "reason" in body["errors"]
    assert count(app, UserRole, user_id=ana) == 0


def test_assign_direct_role_errors(http_client, rbac):
    admin = setup_admin(rbac)
    ana = rbac.user("ana")
    role = rbac.role("Auditor", [Perm.CASH_MOVEMENTS_READ])
    body = {"role_id": role, "reason": "motivo"}

    assert_error(http_client.post(f"{BASE}/999999/roles", json=body, headers=admin.headers), 404, "NOT_FOUND")
    assert_error(http_client.post(f"{BASE}/{ana}/roles", json={"role_id": 999999, "reason": "m"},
                                  headers=admin.headers), 404, "NOT_FOUND")
    assert http_client.post(f"{BASE}/{ana}/roles", json=body, headers=admin.headers).status_code == 201
    assert_error(http_client.post(f"{BASE}/{ana}/roles", json=body, headers=admin.headers), 409, "ALREADY_ASSIGNED")


def test_assign_direct_role_to_self_is_self_assignment(http_client, rbac, app):
    admin = setup_admin(rbac)
    role = rbac.role("Borrador", [Perm.ORDERS_DELETE])

    resp = http_client.post(f"{BASE}/{admin.id}/roles", json={"role_id": role, "reason": "yo"},
                            headers=admin.headers)

    assert resp.status_code == 409
    assert resp.get_json() == SELF_ASSIGNMENT_BODY
    assert count(app, UserRole, user_id=admin.id) == 0


def test_superuser_is_exempt_from_self_assignment(http_client, rbac, auth_headers):
    setup_admin(rbac)
    role = rbac.role("Borrador", [Perm.ORDERS_DELETE])
    resp = http_client.post(f"{BASE}/1/roles", json={"role_id": role, "reason": "pruebas"}, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.get_json()["assigned_by"] == {"id": 1, "username": "operador"}


def test_remove_direct_role(http_client, rbac, app):
    admin = setup_admin(rbac)
    ana = rbac.user("ana")
    role = rbac.role("Auditor", [Perm.CASH_MOVEMENTS_READ])
    rbac.assign_direct(ana, role)

    assert http_client.delete(f"{BASE}/{ana}/roles/{role}", headers=admin.headers).status_code == 204
    assert count(app, UserRole, user_id=ana) == 0
    assert_error(http_client.delete(f"{BASE}/{ana}/roles/{role}", headers=admin.headers), 404, "NOT_FOUND")


def test_remove_own_only_direct_manage_role_is_self_lockout(http_client, rbac, app):
    rbac.sync_catalog()
    boss = rbac.user("jefa")
    role = rbac.role("Admin directo", [Perm.RBAC_READ, Perm.RBAC_MANAGE])
    rbac.assign_direct(boss, role)

    resp = http_client.delete(f"{BASE}/{boss}/roles/{role}", headers=rbac.headers(boss))

    assert_error(resp, 409, "SELF_LOCKOUT")
    assert count(app, UserRole, user_id=boss) == 1


# --- acceso efectivo --------------------------------------------------------------------


def test_access_shows_role_origins_and_permission_sources(http_client, rbac):
    admin = setup_admin(rbac)
    ana = rbac.user("ana")
    operator = rbac.role("Operador", [Perm.ORDERS_READ, Perm.PRINTERS_READ])
    auditor = rbac.role("Auditor", [Perm.ORDERS_READ])
    ops = rbac.group("Operadores", [operator])
    night = rbac.group("Noche", [operator])
    rbac.add_member(ana, ops)
    rbac.add_member(ana, night)
    rbac.assign_direct(ana, auditor, reason="Cubre auditoría")

    resp = http_client.get(f"{BASE}/{ana}/access", headers=admin.headers)

    assert resp.status_code == 200
    body = resp.get_json()
    assert {k: body[k] for k in ("user_id", "username", "is_active", "is_superuser")} == {
        "user_id": ana, "username": "ana", "is_active": True, "is_superuser": False,
    }
    roles = {r["role"]["name"]: r for r in body["roles"]}
    assert [r["role"]["name"] for r in body["roles"]] == ["Auditor", "Operador"]
    assert roles["Operador"] == {
        "role": {"id": operator, "name": "Operador"},
        "sources": [
            {"type": "group", "group": {"id": night, "name": "Noche"}},
            {"type": "group", "group": {"id": ops, "name": "Operadores"}},
        ],
    }
    direct_source = roles["Auditor"]["sources"][0]
    assert direct_source["type"] == "direct"
    assert direct_source["reason"] == "Cubre auditoría"
    assert direct_source["assigned_by"] == {"id": 1, "username": "operador"}
    assert "T" in direct_source["assigned_at"]

    perms = {p["code"]: p for p in body["permissions"]}
    assert [p["code"] for p in body["permissions"]] == ["orders:read", "printers:read"]
    assert perms["orders:read"]["resource"] == "orders"
    assert perms["orders:read"]["action"] == "read"
    assert perms["orders:read"]["description"] == "Ver pedidos, su detalle e historial de estados"
    assert perms["orders:read"]["sources"] == [
        {"type": "group", "group": {"id": night, "name": "Noche"}, "role": {"id": operator, "name": "Operador"}},
        {"type": "group", "group": {"id": ops, "name": "Operadores"}, "role": {"id": operator, "name": "Operador"}},
        {"type": "direct", "role": {"id": auditor, "name": "Auditor"}},
    ]


def test_access_for_superuser_lists_full_catalog(http_client, rbac):
    admin = setup_admin(rbac)

    body = http_client.get(f"{BASE}/1/access", headers=admin.headers).get_json()

    assert body["is_superuser"] is True
    assert body["roles"] == []
    assert sorted(p["code"] for p in body["permissions"]) == sorted(p.value for p in Perm)
    assert all(p["sources"] == [{"type": "superuser"}] for p in body["permissions"])


def test_access_for_own_user_with_read_only(http_client, rbac):
    rbac.sync_catalog()
    lector = reader(rbac)

    resp = http_client.get(f"{BASE}/{lector.id}/access", headers=lector.headers)

    assert resp.status_code == 200
    assert [p["code"] for p in resp.get_json()["permissions"]] == ["rbac:read"]


def test_access_of_admin_shows_its_group(http_client, rbac):
    admin = setup_admin(rbac)
    body = http_client.get(f"{BASE}/{admin.id}/access", headers=admin.headers).get_json()
    assert body["roles"][0]["role"]["name"] == ADMIN_ROLE
    assert body["roles"][0]["sources"][0]["group"]["name"] == ADMIN_GROUP
    assert_error(http_client.get(f"{BASE}/999999/access", headers=admin.headers), 404, "NOT_FOUND")
