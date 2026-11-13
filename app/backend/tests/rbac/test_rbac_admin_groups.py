"""Administración de grupos: CRUD, miembros y roles del grupo (api-contract.md §3). Etapa 6."""

from app.rbac.constants import Perm
from app.rbac.models import Group, GroupRole, UserGroup
from tests.rbac.admin_support import (
    ADMIN_GROUP,
    SELF_ASSIGNMENT_BODY,
    assert_error,
    count,
    fetch,
    setup_admin,
)

BASE = "/api/rbac/groups"
DETAIL_KEYS = {"id", "name", "description", "created_at", "updated_at", "members", "roles"}


# --- CRUD -------------------------------------------------------------------------------


def test_create_group_returns_detail_and_audits_actor(http_client, rbac, app):
    admin = setup_admin(rbac)

    resp = http_client.post(
        BASE,
        json={"name": "  Operadores  ", "description": "Operadores del taller", "created_by": 999},
        headers=admin.headers,
    )

    assert resp.status_code == 201
    body = resp.get_json()
    assert set(body) == DETAIL_KEYS
    assert body["name"] == "Operadores"
    assert body["description"] == "Operadores del taller"
    assert body["members"] == [] and body["roles"] == []
    assert "T" in body["created_at"] and not body["created_at"].endswith("Z")
    row = fetch(app, Group, id=body["id"])
    assert row["created_by"] == admin.id and row["updated_by"] == admin.id


def test_create_group_validates_body(http_client, rbac):
    admin = setup_admin(rbac)

    for payload, field in (
        ({"name": "   "}, "name"),
        ({}, "name"),
        ({"name": 12}, "name"),
        ({"name": "x" * 101}, "name"),
        ({"name": "Ok", "description": "x" * 256}, "description"),
        ({"name": "Ok", "description": 5}, "description"),
    ):
        body = assert_error(http_client.post(BASE, json=payload, headers=admin.headers), 422, "VALIDATION_ERROR")
        assert field in body["errors"], payload


def test_create_group_with_taken_name_is_409_case_insensitive(http_client, rbac):
    admin = setup_admin(rbac)
    rbac.group("Operadores")

    resp = http_client.post(BASE, json={"name": "operadores"}, headers=admin.headers)
    assert_error(resp, 409, "NAME_TAKEN")


def test_list_groups_with_counts_and_filter(http_client, rbac):
    admin = setup_admin(rbac)
    role = rbac.role("Operador", [Perm.ORDERS_READ])
    ops = rbac.group("Operadores", [role])
    rbac.add_member(rbac.user("ana"), ops)
    rbac.add_member(rbac.user("beto"), ops)

    resp = http_client.get(BASE, headers=admin.headers)
    assert resp.status_code == 200
    by_name = {g["name"]: g for g in resp.get_json()}
    assert by_name["Operadores"] == {
        "id": ops, "name": "Operadores", "description": None, "members_count": 2, "roles_count": 1,
    }
    assert by_name[ADMIN_GROUP]["members_count"] == 1

    filtered = http_client.get(f"{BASE}?q=OPER", headers=admin.headers).get_json()
    assert [g["name"] for g in filtered] == ["Operadores"]


def test_get_group_detail_sorted(http_client, rbac):
    admin = setup_admin(rbac)
    zeta = rbac.role("Zeta", [Perm.ORDERS_READ])
    alfa = rbac.role("Alfa", [Perm.PRINTERS_READ])
    group = rbac.group("Taller", [zeta, alfa])
    rbac.add_member(rbac.user("zoe"), group)
    ana = rbac.user("ana", is_active=False)
    rbac.add_member(ana, group)

    resp = http_client.get(f"{BASE}/{group}", headers=admin.headers)

    assert resp.status_code == 200
    body = resp.get_json()
    assert [m["username"] for m in body["members"]] == ["ana", "zoe"]
    assert body["members"][0] == {"id": ana, "username": "ana", "is_active": False}
    assert [r["name"] for r in body["roles"]] == ["Alfa", "Zeta"]
    assert set(body["roles"][0]) == {"id", "name", "description"}


def test_get_missing_group_is_404(http_client, rbac):
    admin = setup_admin(rbac)
    assert_error(http_client.get(f"{BASE}/999999", headers=admin.headers), 404, "NOT_FOUND")


def test_update_group(http_client, rbac, app):
    admin = setup_admin(rbac)
    group = rbac.group("Taller")

    resp = http_client.put(
        f"{BASE}/{group}", json={"name": "Taller 2", "description": "Turno tarde"}, headers=admin.headers
    )

    assert resp.status_code == 200
    assert resp.get_json()["name"] == "Taller 2"
    assert resp.get_json()["description"] == "Turno tarde"
    assert fetch(app, Group, id=group)["updated_by"] == admin.id


def test_update_group_keeps_own_name_but_rejects_other_groups_name(http_client, rbac):
    admin = setup_admin(rbac)
    group = rbac.group("Taller")

    assert http_client.put(f"{BASE}/{group}", json={"name": "Taller"}, headers=admin.headers).status_code == 200
    resp = http_client.put(f"{BASE}/{group}", json={"name": ADMIN_GROUP}, headers=admin.headers)
    assert_error(resp, 409, "NAME_TAKEN")


def test_update_missing_group_is_404_before_validation(http_client, rbac):
    admin = setup_admin(rbac)
    resp = http_client.put(f"{BASE}/999999", json={"name": ""}, headers=admin.headers)
    assert_error(resp, 404, "NOT_FOUND")


def test_delete_group_cascades_memberships_and_roles(http_client, rbac, app):
    admin = setup_admin(rbac)
    group = rbac.group("Taller", [rbac.role("Operador", [Perm.ORDERS_READ])])
    rbac.add_member(rbac.user("ana"), group)

    resp = http_client.delete(f"{BASE}/{group}", headers=admin.headers)

    assert resp.status_code == 204
    assert count(app, Group, id=group) == 0
    assert count(app, UserGroup, group_id=group) == 0
    assert count(app, GroupRole, group_id=group) == 0


def test_delete_own_admin_group_is_self_lockout(http_client, rbac, app):
    admin = setup_admin(rbac)

    resp = http_client.delete(f"{BASE}/{admin.group_id}", headers=admin.headers)

    body = assert_error(resp, 409, "SELF_LOCKOUT")
    assert body["error"] == "No podés quitarte a vos mismo el permiso de administrar seguridad"
    assert count(app, Group, id=admin.group_id) == 1


def test_delete_own_group_allowed_when_manage_comes_from_elsewhere(http_client, rbac):
    admin = setup_admin(rbac)
    rbac.assign_direct(admin.id, rbac.role("Respaldo", [Perm.RBAC_MANAGE]))

    assert http_client.delete(f"{BASE}/{admin.group_id}", headers=admin.headers).status_code == 204


def test_superuser_can_delete_any_group(http_client, rbac, auth_headers):
    admin = setup_admin(rbac)
    assert http_client.delete(f"{BASE}/{admin.group_id}", headers=auth_headers).status_code == 204


# --- miembros ---------------------------------------------------------------------------


def test_list_members(http_client, rbac):
    admin = setup_admin(rbac)
    resp = http_client.get(f"{BASE}/{admin.group_id}/members", headers=admin.headers)
    assert resp.status_code == 200
    assert resp.get_json() == [{"id": admin.id, "username": "admin", "is_active": True}]


def test_add_member_returns_updated_detail(http_client, rbac, app):
    admin = setup_admin(rbac)
    group = rbac.group("Taller")
    ana = rbac.user("ana")

    resp = http_client.post(f"{BASE}/{group}/members", json={"user_id": ana}, headers=admin.headers)

    assert resp.status_code == 201
    body = resp.get_json()
    assert set(body) == DETAIL_KEYS
    assert body["members"] == [{"id": ana, "username": "ana", "is_active": True}]
    assert fetch(app, UserGroup, user_id=ana, group_id=group)["created_by"] == admin.id


def test_add_member_twice_is_already_member(http_client, rbac):
    admin = setup_admin(rbac)
    group = rbac.group("Taller")
    ana = rbac.user("ana")
    rbac.add_member(ana, group)

    resp = http_client.post(f"{BASE}/{group}/members", json={"user_id": ana}, headers=admin.headers)
    assert_error(resp, 409, "ALREADY_MEMBER")


def test_add_member_errors(http_client, rbac):
    admin = setup_admin(rbac)
    group = rbac.group("Taller")

    assert_error(http_client.post(f"{BASE}/999999/members", json={"user_id": "x"}, headers=admin.headers),
                 404, "NOT_FOUND")
    for bad in ({}, {"user_id": "7"}, {"user_id": True}, {"user_id": None}):
        body = assert_error(http_client.post(f"{BASE}/{group}/members", json=bad, headers=admin.headers),
                            422, "VALIDATION_ERROR")
        assert "user_id" in body["errors"]
    assert_error(http_client.post(f"{BASE}/{group}/members", json={"user_id": 999999}, headers=admin.headers),
                 404, "NOT_FOUND")


def test_add_self_as_member_is_self_assignment_even_without_roles(http_client, rbac, app):
    admin = setup_admin(rbac)
    group = rbac.group("Vacío")

    resp = http_client.post(f"{BASE}/{group}/members", json={"user_id": admin.id}, headers=admin.headers)

    assert resp.status_code == 409
    assert resp.get_json() == SELF_ASSIGNMENT_BODY
    assert count(app, UserGroup, user_id=admin.id, group_id=group) == 0


def test_self_assignment_is_checked_before_already_member(http_client, rbac):
    admin = setup_admin(rbac)
    resp = http_client.post(
        f"{BASE}/{admin.group_id}/members", json={"user_id": admin.id}, headers=admin.headers
    )
    assert_error(resp, 409, "SELF_ASSIGNMENT")


def test_superuser_can_add_himself(http_client, rbac, auth_headers):
    setup_admin(rbac)
    group = rbac.group("Taller")
    resp = http_client.post(f"{BASE}/{group}/members", json={"user_id": 1}, headers=auth_headers)
    assert resp.status_code == 201


def test_remove_member(http_client, rbac, app):
    admin = setup_admin(rbac)
    group = rbac.group("Taller")
    ana = rbac.user("ana")
    rbac.add_member(ana, group)

    assert http_client.delete(f"{BASE}/{group}/members/{ana}", headers=admin.headers).status_code == 204
    assert count(app, UserGroup, user_id=ana, group_id=group) == 0
    assert_error(http_client.delete(f"{BASE}/{group}/members/{ana}", headers=admin.headers), 404, "NOT_FOUND")


def test_remove_self_from_admin_group_is_self_lockout(http_client, rbac, app):
    admin = setup_admin(rbac)

    resp = http_client.delete(f"{BASE}/{admin.group_id}/members/{admin.id}", headers=admin.headers)

    assert_error(resp, 409, "SELF_LOCKOUT")
    assert count(app, UserGroup, user_id=admin.id, group_id=admin.group_id) == 1


def test_remove_self_from_harmless_group_is_allowed(http_client, rbac):
    admin = setup_admin(rbac)
    group = rbac.group("Taller", [rbac.role("Operador", [Perm.ORDERS_READ])])
    rbac.add_member(admin.id, group)

    assert http_client.delete(f"{BASE}/{group}/members/{admin.id}", headers=admin.headers).status_code == 204


# --- roles del grupo --------------------------------------------------------------------


def test_list_group_roles(http_client, rbac):
    admin = setup_admin(rbac)
    resp = http_client.get(f"{BASE}/{admin.group_id}/roles", headers=admin.headers)
    assert resp.status_code == 200
    assert resp.get_json() == [{"id": admin.role_id, "name": "Admin seguridad", "description": None}]


def test_add_role_to_group(http_client, rbac, app):
    admin = setup_admin(rbac)
    group = rbac.group("Taller")
    role = rbac.role("Operador", [Perm.ORDERS_READ])

    resp = http_client.post(f"{BASE}/{group}/roles", json={"role_id": role}, headers=admin.headers)

    assert resp.status_code == 201
    assert resp.get_json()["roles"] == [{"id": role, "name": "Operador", "description": None}]
    assert fetch(app, GroupRole, group_id=group, role_id=role)["created_by"] == admin.id


def test_add_role_to_group_errors(http_client, rbac):
    admin = setup_admin(rbac)
    group = rbac.group("Taller")
    role = rbac.role("Operador", [Perm.ORDERS_READ])
    rbac_headers = admin.headers

    assert_error(http_client.post(f"{BASE}/{group}/roles", json={"role_id": 999999}, headers=rbac_headers),
                 404, "NOT_FOUND")
    assert_error(http_client.post(f"{BASE}/{group}/roles", json={"role_id": "1"}, headers=rbac_headers),
                 422, "VALIDATION_ERROR")
    http_client.post(f"{BASE}/{group}/roles", json={"role_id": role}, headers=rbac_headers)
    assert_error(http_client.post(f"{BASE}/{group}/roles", json={"role_id": role}, headers=rbac_headers),
                 409, "ALREADY_ASSIGNED")


def test_add_role_to_own_group_is_self_assignment(http_client, rbac, app):
    admin = setup_admin(rbac)
    role = rbac.role("Borrador", [Perm.ORDERS_DELETE])

    resp = http_client.post(f"{BASE}/{admin.group_id}/roles", json={"role_id": role}, headers=admin.headers)

    assert resp.status_code == 409
    assert resp.get_json() == SELF_ASSIGNMENT_BODY
    assert count(app, GroupRole, group_id=admin.group_id, role_id=role) == 0


def test_remove_role_from_group(http_client, rbac, app):
    admin = setup_admin(rbac)
    role = rbac.role("Operador", [Perm.ORDERS_READ])
    group = rbac.group("Taller", [role])

    assert http_client.delete(f"{BASE}/{group}/roles/{role}", headers=admin.headers).status_code == 204
    assert count(app, GroupRole, group_id=group, role_id=role) == 0
    assert_error(http_client.delete(f"{BASE}/{group}/roles/{role}", headers=admin.headers), 404, "NOT_FOUND")


def test_remove_admin_role_from_own_group_is_self_lockout(http_client, rbac, app):
    admin = setup_admin(rbac)

    resp = http_client.delete(f"{BASE}/{admin.group_id}/roles/{admin.role_id}", headers=admin.headers)

    assert_error(resp, 409, "SELF_LOCKOUT")
    assert count(app, GroupRole, group_id=admin.group_id, role_id=admin.role_id) == 1
