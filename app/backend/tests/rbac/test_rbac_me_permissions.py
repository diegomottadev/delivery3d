"""GET /api/auth/me/permissions — contrato FIJO (api-contract.md §1). Etapa 4 — rojo."""

from app.rbac.constants import Perm

URL = "/api/auth/me/permissions"


def test_returns_effective_permissions_sorted_without_duplicates(http_client, rbac):
    rbac.sync_catalog()
    ana = rbac.user("ana")
    via_group = rbac.role("Lector", [Perm.ORDERS_READ, Perm.PRINTERS_READ])
    direct = rbac.role("Auditor", [Perm.ORDERS_READ, Perm.CASH_MOVEMENTS_READ])
    rbac.add_member(ana, rbac.group("Taller", [via_group]))
    rbac.assign_direct(ana, direct)

    resp = http_client.get(URL, headers=rbac.headers(ana))

    assert resp.status_code == 200
    assert resp.get_json() == {
        "user_id": ana,
        "is_superuser": False,
        "permissions": ["cash_movements:read", "orders:read", "printers:read"],
    }


def test_user_without_roles_gets_empty_list_not_403(http_client, rbac):
    rbac.sync_catalog()
    beto = rbac.user("beto")

    resp = http_client.get(URL, headers=rbac.headers(beto))

    assert resp.status_code == 200
    assert resp.get_json() == {"user_id": beto, "is_superuser": False, "permissions": []}


def test_superuser_gets_full_catalog(http_client, rbac):
    rbac.sync_catalog()
    jefa = rbac.user("jefa", is_superuser=True)

    resp = http_client.get(URL, headers=rbac.headers(jefa))

    assert resp.status_code == 200
    assert resp.get_json() == {
        "user_id": jefa,
        "is_superuser": True,
        "permissions": sorted(p.value for p in Perm),
    }


def test_without_session_gets_401(http_client):
    resp = http_client.get(URL)
    assert resp.status_code == 401


def test_inactive_user_gets_401(http_client, rbac):
    rbac.sync_catalog()
    ana = rbac.user("ana", is_active=False)

    resp = http_client.get(URL, headers=rbac.headers(ana))
    assert resp.status_code == 401
