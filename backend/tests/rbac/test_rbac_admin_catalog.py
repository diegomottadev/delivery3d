"""GET /api/rbac/permissions: catálogo agrupado por resource (api-contract.md §5). Etapa 6."""

from app.rbac.constants import PERM_DESCRIPTIONS, RESOURCE_LABELS, Perm
from tests.rbac.admin_support import reader

URL = "/api/rbac/permissions"


def test_catalog_grouped_by_resource_in_declared_order(http_client, rbac):
    rbac.sync_catalog()
    lector = reader(rbac)
    zeta = rbac.role("Zeta", [Perm.ORDERS_DELETE])
    encargado = rbac.role("Encargado", [Perm.ORDERS_DELETE])

    resp = http_client.get(URL, headers=lector.headers)

    assert resp.status_code == 200
    body = resp.get_json()
    assert [g["resource"] for g in body] == list(RESOURCE_LABELS)
    assert [g["resource_label"] for g in body] == list(RESOURCE_LABELS.values())

    orders = body[0]
    assert [p["code"] for p in orders["permissions"]] == [p.value for p in Perm if p.resource == "orders"]
    delete = next(p for p in orders["permissions"] if p["code"] == "orders:delete")
    assert delete == {
        "code": "orders:delete",
        "action": "delete",
        "description": PERM_DESCRIPTIONS[Perm.ORDERS_DELETE],
        "roles": [{"id": encargado, "name": "Encargado"}, {"id": zeta, "name": "Zeta"}],
    }
    total = sum(len(g["permissions"]) for g in body)
    assert total == len(Perm)


def test_catalog_has_no_write_methods(http_client, rbac, auth_headers):
    for method in ("post", "put", "delete"):
        assert getattr(http_client, method)(URL, json={}, headers=auth_headers).status_code == 405
