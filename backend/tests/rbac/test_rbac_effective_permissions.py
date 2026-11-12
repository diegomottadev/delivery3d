"""Resolución de permisos efectivos (rbac-access-control, etapa 4 — rojo).

Contrato de `app.rbac.services.get_effective_permissions(user_id) -> frozenset[str]`:
unión de los permisos de los roles obtenidos por grupo y por asignación directa.
Solo mira roles: NO aplica el bypass de superusuario (eso lo hace
`app.rbac.security.get_user_permissions`).
"""

import pytest

from app.rbac.constants import Perm


@pytest.fixture
def effective(app):
    from app.rbac.services import get_effective_permissions

    def _resolve(user_id: int) -> frozenset:
        with app.app_context():
            return get_effective_permissions(user_id)

    return _resolve


def test_permission_via_group(rbac, effective):
    rbac.sync_catalog()
    ana = rbac.user("ana")
    role = rbac.role("Lector", [Perm.ORDERS_READ])
    rbac.add_member(ana, rbac.group("Taller", [role]))

    assert effective(ana) == frozenset({"orders:read"})


def test_permission_via_direct_role(rbac, effective):
    rbac.sync_catalog()
    ana = rbac.user("ana")
    rbac.assign_direct(ana, rbac.role("Auditor", [Perm.CASH_MOVEMENTS_READ]))

    assert effective(ana) == frozenset({"cash_movements:read"})


def test_union_of_group_and_direct_without_duplicates(rbac, effective):
    rbac.sync_catalog()
    ana = rbac.user("ana")
    via_group = rbac.role("Lector", [Perm.ORDERS_READ, Perm.PRINTERS_READ])
    direct = rbac.role("Auditor", [Perm.ORDERS_READ, Perm.CASH_MOVEMENTS_READ])
    rbac.add_member(ana, rbac.group("Taller", [via_group]))
    rbac.assign_direct(ana, direct)

    result = effective(ana)
    assert isinstance(result, frozenset)
    assert result == frozenset({"orders:read", "printers:read", "cash_movements:read"})


def test_user_in_two_groups_gets_both(rbac, effective):
    rbac.sync_catalog()
    ana = rbac.user("ana")
    rbac.add_member(ana, rbac.group("Pedidos", [rbac.role("R1", [Perm.ORDERS_READ])]))
    rbac.add_member(ana, rbac.group("Caja", [rbac.role("R2", [Perm.CASH_MOVEMENTS_CREATE])]))

    assert effective(ana) == frozenset({"orders:read", "cash_movements:create"})


def test_group_with_several_roles(rbac, effective):
    rbac.sync_catalog()
    ana = rbac.user("ana")
    r1 = rbac.role("R1", [Perm.ORDERS_READ])
    r2 = rbac.role("R2", [Perm.SETTINGS_READ])
    rbac.add_member(ana, rbac.group("Taller", [r1, r2]))

    assert effective(ana) == frozenset({"orders:read", "settings:read"})


def test_user_without_roles_has_no_permissions(rbac, effective):
    rbac.sync_catalog()
    ana = rbac.user("ana")

    assert effective(ana) == frozenset()


def test_permissions_of_other_users_do_not_leak(rbac, effective):
    rbac.sync_catalog()
    ana = rbac.user("ana")
    beto = rbac.user("beto")
    role = rbac.role("Lector", [Perm.ORDERS_READ])
    rbac.add_member(ana, rbac.group("Taller", [role]))
    rbac.assign_direct(ana, rbac.role("Auditor", [Perm.CASH_MOVEMENTS_READ]))

    assert effective(beto) == frozenset()


def test_superuser_flag_is_not_applied_by_effective_permissions(rbac, effective):
    rbac.sync_catalog()
    jefa = rbac.user("jefa", is_superuser=True)

    assert effective(jefa) == frozenset()
