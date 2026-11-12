"""Catálogo de permisos (rbac-access-control, etapa 3). Lógica pura: no toca la base."""

import re

from app.rbac.constants import (
    OPERATOR_ROLE_PERMS,
    PERM_DESCRIPTIONS,
    RESOURCE_LABELS,
    Perm,
)

CODE_RE = re.compile(r"^[a-z][a-z_]*:[a-z][a-z_]*$")
BASE_ACTIONS = {"read", "create", "update", "delete"}
BUSINESS_ACTIONS = {"quote", "approve", "produce", "deliver", "manage"}

APPROVED_CATALOG = {
    "orders:read", "orders:create", "orders:update", "orders:delete",
    "orders:quote", "orders:approve", "orders:produce", "orders:deliver",
    "cash_movements:read", "cash_movements:create",
    "cash_categories:read", "cash_categories:create", "cash_categories:update",
    "printers:read", "printers:create", "printers:update",
    "settings:read", "settings:update",
    "materials:read", "filaments:read",
    "rbac:read", "rbac:manage",
}

APPROVED_OPERATOR = {
    "orders:read", "orders:create", "orders:update", "orders:quote",
    "orders:approve", "orders:produce", "orders:deliver",
    "cash_movements:read", "cash_movements:create", "cash_categories:read",
    "printers:read", "settings:read", "materials:read", "filaments:read",
}


def test_catalog_is_exactly_the_approved_one():
    assert {p.value for p in Perm} == APPROVED_CATALOG
    assert len(Perm) == 22


def test_codes_follow_resource_action_format():
    for perm in Perm:
        assert CODE_RE.match(perm.value), perm.value
        assert "*" not in perm.value


def test_member_name_is_code_upper():
    for perm in Perm:
        assert perm.name == perm.value.upper().replace(":", "_")


def test_resource_and_action_are_derived_from_code():
    for perm in Perm:
        resource, action = perm.value.split(":")
        assert perm.resource == resource
        assert perm.action == action


def test_actions_are_base_or_whitelisted_business_actions():
    for perm in Perm:
        assert perm.action in BASE_ACTIONS | BUSINESS_ACTIONS, perm.value


def test_every_perm_has_a_non_blank_spanish_description():
    assert set(PERM_DESCRIPTIONS) == set(Perm)
    for perm, description in PERM_DESCRIPTIONS.items():
        assert description.strip(), perm
        assert len(description) <= 255


def test_resource_labels_cover_exactly_the_catalog_resources():
    assert set(RESOURCE_LABELS) == {p.resource for p in Perm}
    for label in RESOURCE_LABELS.values():
        assert label.strip()


def test_operator_role_is_the_explicit_approved_list():
    assert isinstance(OPERATOR_ROLE_PERMS, frozenset)
    assert {p.value for p in OPERATOR_ROLE_PERMS} == APPROVED_OPERATOR
    assert len(OPERATOR_ROLE_PERMS) == 14


def test_operator_role_excludes_sensitive_permissions():
    forbidden = {
        Perm.ORDERS_DELETE, Perm.RBAC_READ, Perm.RBAC_MANAGE, Perm.SETTINGS_UPDATE,
        Perm.PRINTERS_CREATE, Perm.PRINTERS_UPDATE,
        Perm.CASH_CATEGORIES_CREATE, Perm.CASH_CATEGORIES_UPDATE,
    }
    assert not (OPERATOR_ROLE_PERMS & forbidden)
