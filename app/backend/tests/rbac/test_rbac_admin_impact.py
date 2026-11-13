"""Endpoints de impacto (api-contract.md §6): solo lectura, sin efectos. Etapa 6."""

from app.rbac.constants import PERM_DESCRIPTIONS, Perm
from app.rbac.models import GroupRole, RolePermission, UserGroup
from tests.rbac.admin_support import assert_error, count, reader, setup_admin

def _u(user_id, username, lost):
    """Usuario afectado esperado: codes + detalle {code, description} en el mismo orden."""
    return {
        "id": user_id,
        "username": username,
        "lost_permissions": lost,
        "lost_permissions_detail": [{"code": c, "description": PERM_DESCRIPTIONS[Perm(c)]} for c in lost],
    }


KEYS = {"affected_users_count", "users_losing_permissions_count", "affected_users", "removes_own_rbac_manage"}


def _taller(rbac):
    """Grupo "Taller" (rol Operador: orders:read + printers:read) con ana y beto.

    beto además tiene orders:read directo, así que al perder el rol solo pierde printers:read.
    """
    operator = rbac.role("Operador", [Perm.ORDERS_READ, Perm.PRINTERS_READ])
    group = rbac.group("Taller", [operator])
    ana, beto = rbac.user("ana"), rbac.user("beto")
    rbac.add_member(ana, group)
    rbac.add_member(beto, group)
    rbac.assign_direct(beto, rbac.role("Lector pedidos", [Perm.ORDERS_READ]))
    return operator, group, ana, beto


def test_group_role_removal_impact(http_client, rbac, app):
    admin = setup_admin(rbac)
    operator, group, ana, beto = _taller(rbac)
    carla = rbac.user("carla")
    rbac.add_member(carla, rbac.group("Otro", [operator]))  # lo tiene por otro grupo: no pierde nada
    rbac.add_member(carla, group)

    resp = http_client.get(f"/api/rbac/groups/{group}/roles/{operator}/removal-impact", headers=admin.headers)

    assert resp.status_code == 200
    assert resp.get_json() == {
        "affected_users_count": 3,
        "users_losing_permissions_count": 2,
        "affected_users": [
            _u(ana, "ana", ["orders:read", "printers:read"]),
            _u(beto, "beto", ["printers:read"]),
            _u(carla, "carla", []),
        ],
        "removes_own_rbac_manage": False,
    }
    assert count(app, GroupRole, group_id=group, role_id=operator) == 1


def test_member_removal_impact(http_client, rbac):
    admin = setup_admin(rbac)
    _, group, _, beto = _taller(rbac)

    body = http_client.get(f"/api/rbac/groups/{group}/members/{beto}/removal-impact", headers=admin.headers).get_json()

    assert body == {
        "affected_users_count": 1,
        "users_losing_permissions_count": 1,
        "affected_users": [_u(beto, "beto", ["printers:read"])],
        "removes_own_rbac_manage": False,
    }


def test_direct_role_removal_impact(http_client, rbac):
    admin = setup_admin(rbac)
    _, _, _, beto = _taller(rbac)
    direct = rbac.role("Borrador", [Perm.ORDERS_DELETE, Perm.ORDERS_READ])
    rbac.assign_direct(beto, direct)

    body = http_client.get(f"/api/rbac/users/{beto}/roles/{direct}/removal-impact", headers=admin.headers).get_json()

    assert body["affected_users"] == [_u(beto, "beto", ["orders:delete"])]
    assert body["users_losing_permissions_count"] == 1


def test_group_deletion_impact(http_client, rbac):
    admin = setup_admin(rbac)
    _, group, ana, beto = _taller(rbac)

    body = http_client.get(f"/api/rbac/groups/{group}/removal-impact", headers=admin.headers).get_json()

    assert body["affected_users_count"] == 2
    assert [u["id"] for u in body["affected_users"]] == [ana, beto]


def test_role_deletion_impact_lists_every_holder(http_client, rbac):
    admin = setup_admin(rbac)
    operator, _, ana, beto = _taller(rbac)
    dora = rbac.user("dora")
    rbac.assign_direct(dora, operator)

    body = http_client.get(f"/api/rbac/roles/{operator}/removal-impact", headers=admin.headers).get_json()

    assert set(body) == KEYS
    assert [u["username"] for u in body["affected_users"]] == ["ana", "beto", "dora"]
    assert body["users_losing_permissions_count"] == 3


def test_permissions_change_impact_previews_new_set(http_client, rbac, app):
    admin = setup_admin(rbac)
    operator, _, ana, beto = _taller(rbac)

    resp = http_client.post(
        f"/api/rbac/roles/{operator}/permissions/impact",
        json={"permissions": ["orders:read", "orders:create"]},
        headers=admin.headers,
    )

    assert resp.status_code == 200
    assert resp.get_json() == {
        "affected_users_count": 2,
        "users_losing_permissions_count": 2,
        "affected_users": [
            _u(ana, "ana", ["printers:read"]),
            _u(beto, "beto", ["printers:read"]),
        ],
        "removes_own_rbac_manage": False,
    }
    assert count(app, RolePermission, role_id=operator) == 2


def test_permissions_change_impact_validates(http_client, rbac):
    admin = setup_admin(rbac)
    operator, _, _, _ = _taller(rbac)
    url = f"/api/rbac/roles/{operator}/permissions/impact"

    assert_error(http_client.post(url, json={"permissions": ["nope:x"]}, headers=admin.headers),
                 422, "UNKNOWN_PERMISSION")
    assert_error(http_client.post(url, json={"permissions": "x"}, headers=admin.headers), 422, "VALIDATION_ERROR")
    assert_error(http_client.post("/api/rbac/roles/999999/permissions/impact", json={"permissions": []},
                                  headers=admin.headers), 404, "NOT_FOUND")


def test_removes_own_rbac_manage_matches_self_lockout(http_client, rbac, app):
    admin = setup_admin(rbac)
    impact_urls = [
        f"/api/rbac/groups/{admin.group_id}/roles/{admin.role_id}/removal-impact",
        f"/api/rbac/groups/{admin.group_id}/members/{admin.id}/removal-impact",
        f"/api/rbac/groups/{admin.group_id}/removal-impact",
        f"/api/rbac/roles/{admin.role_id}/removal-impact",
    ]
    for url in impact_urls:
        body = http_client.get(url, headers=admin.headers).get_json()
        assert body["removes_own_rbac_manage"] is True, url
        assert body["affected_users"] == [
            _u(admin.id, "admin", ["rbac:manage", "rbac:read"])
        ]

    body = http_client.post(f"/api/rbac/roles/{admin.role_id}/permissions/impact",
                            json={"permissions": ["rbac:read"]}, headers=admin.headers).get_json()
    assert body["removes_own_rbac_manage"] is True
    assert count(app, UserGroup, user_id=admin.id) == 1


def test_superuser_never_loses_permissions(http_client, rbac, auth_headers):
    setup_admin(rbac)
    role = rbac.role("Operador", [Perm.ORDERS_READ])
    group = rbac.group("Taller", [role])
    rbac.add_member(1, group)

    body = http_client.get(f"/api/rbac/groups/{group}/roles/{role}/removal-impact", headers=auth_headers).get_json()

    assert body == {
        "affected_users_count": 1,
        "users_losing_permissions_count": 0,
        "affected_users": [_u(1, "operador", [])],
        "removes_own_rbac_manage": False,
    }


def test_impact_of_missing_assignment_is_404(http_client, rbac):
    admin = setup_admin(rbac)
    operator, group, ana, _ = _taller(rbac)
    other = rbac.group("Vacío")

    for url in (
        f"/api/rbac/groups/{other}/roles/{operator}/removal-impact",
        f"/api/rbac/groups/{other}/members/{ana}/removal-impact",
        f"/api/rbac/users/{ana}/roles/{operator}/removal-impact",
        "/api/rbac/groups/999999/removal-impact",
        "/api/rbac/roles/999999/removal-impact",
    ):
        assert_error(http_client.get(url, headers=admin.headers), 404, "NOT_FOUND")


def test_impact_only_needs_rbac_read(http_client, rbac):
    rbac.sync_catalog()
    lector = reader(rbac)
    _, group, ana, _ = _taller(rbac)

    resp = http_client.get(f"/api/rbac/groups/{group}/members/{ana}/removal-impact", headers=lector.headers)
    assert resp.status_code == 200
