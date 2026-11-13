"""Seed idempotente del catálogo y del grupo "Operadores" (rbac-access-control, etapa 3)."""

from app.auth.models import User
from app.extensions import db
from app.rbac.constants import (
    OPERATOR_GROUP_NAME,
    OPERATOR_ROLE_NAME,
    OPERATOR_ROLE_PERMS,
    PERM_DESCRIPTIONS,
    Perm,
)
from app.rbac.models import Group, GroupRole, Permission, Role, RolePermission, UserGroup
from app.rbac.services import seed_rbac


def _role_codes(role_name: str) -> set[str]:
    rows = (
        db.session.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .filter(Role.name == role_name)
        .all()
    )
    return {code for (code,) in rows}


def _add_users(*specs):
    for username, role, is_superuser in specs:
        u = User(username=username, role=role, is_active=True, is_superuser=is_superuser)
        u.set_password("x-secreta-123")
        db.session.add(u)
    db.session.commit()


# --- catálogo --------------------------------------------------------------------------


def test_first_run_creates_full_catalog(app):
    with app.app_context():
        report = seed_rbac()
        perms = {p.code: p for p in Permission.query.all()}
        assert set(perms) == {p.value for p in Perm}
        for perm in Perm:
            row = perms[perm.value]
            assert row.resource == perm.resource
            assert row.action == perm.action
            assert row.description == PERM_DESCRIPTIONS[perm]
        assert sorted(report.catalog.created) == sorted(p.value for p in Perm)
        assert report.catalog.updated == []
        assert report.catalog.orphans == []


def test_second_run_is_idempotent(app):
    with app.app_context():
        seed_rbac()
        snapshot = {
            "permissions": Permission.query.count(),
            "roles": Role.query.count(),
            "groups": Group.query.count(),
            "group_roles": GroupRole.query.count(),
            "role_permissions": RolePermission.query.count(),
            "user_groups": UserGroup.query.count(),
        }
        report = seed_rbac()
        assert report.catalog.created == []
        assert report.catalog.updated == []
        assert report.catalog.unchanged == len(Perm)
        assert report.operator.role_created is False
        assert report.operator.group_created is False
        assert {
            "permissions": Permission.query.count(),
            "roles": Role.query.count(),
            "groups": Group.query.count(),
            "group_roles": GroupRole.query.count(),
            "role_permissions": RolePermission.query.count(),
            "user_groups": UserGroup.query.count(),
        } == snapshot


def test_changed_description_is_updated_but_code_untouched(app):
    with app.app_context():
        seed_rbac()
        row = Permission.query.filter_by(code=Perm.ORDERS_READ.value).one()
        row.description = "descripción vieja"
        db.session.commit()

        report = seed_rbac()

        row = Permission.query.filter_by(code=Perm.ORDERS_READ.value).one()
        assert row.description == PERM_DESCRIPTIONS[Perm.ORDERS_READ]
        assert report.catalog.updated == [Perm.ORDERS_READ.value]


def test_orphan_permission_is_listed_with_its_roles_and_never_deleted(app):
    with app.app_context():
        seed_rbac()
        orphan = Permission(code="orders:legacy", resource="orders", action="legacy", description="viejo")
        db.session.add(orphan)
        db.session.flush()
        role = Role.query.filter_by(name=OPERATOR_ROLE_NAME).one()
        db.session.add(RolePermission(role_id=role.id, permission_id=orphan.id))
        db.session.commit()

        report = seed_rbac()

        assert [(o.code, o.roles) for o in report.catalog.orphans] == [
            ("orders:legacy", [OPERATOR_ROLE_NAME])
        ]
        assert Permission.query.filter_by(code="orders:legacy").count() == 1


# --- bootstrap Operadores / Operador ---------------------------------------------------


def test_bootstrap_creates_operator_role_with_exact_permissions(app):
    with app.app_context():
        report = seed_rbac()
        role = Role.query.filter_by(name=OPERATOR_ROLE_NAME).one()
        assert role.created_by is None
        assert _role_codes(OPERATOR_ROLE_NAME) == {p.value for p in OPERATOR_ROLE_PERMS}
        assert report.operator.role_created is True


def test_bootstrap_creates_group_linked_to_operator_role(app):
    with app.app_context():
        report = seed_rbac()
        group = Group.query.filter_by(name=OPERATOR_GROUP_NAME).one()
        role = Role.query.filter_by(name=OPERATOR_ROLE_NAME).one()
        assert GroupRole.query.filter_by(group_id=group.id, role_id=role.id).count() == 1
        assert group.created_by is None
        assert report.operator.group_created is True


def test_initial_membership_only_legacy_operators_not_superusers(app):
    with app.app_context():
        _add_users(
            ("ana", "operator", False),
            ("beto", "operator", False),
            ("jefa", "admin", True),
            ("raro", "operator", True),  # operator legacy pero superuser: no entra
        )
        report = seed_rbac()
        group = Group.query.filter_by(name=OPERATOR_GROUP_NAME).one()
        members = {
            u.username
            for u in User.query.join(UserGroup, UserGroup.user_id == User.id)
            .filter(UserGroup.group_id == group.id)
            .all()
        }
        assert members == {"ana", "beto"}
        assert sorted(report.operator.members_added) == ["ana", "beto"]


def test_existing_operator_role_is_not_modified_and_diff_is_reported(app):
    with app.app_context():
        seed_rbac()
        role = Role.query.filter_by(name=OPERATOR_ROLE_NAME).one()
        quote = Permission.query.filter_by(code=Perm.ORDERS_QUOTE.value).one()
        delete = Permission.query.filter_by(code=Perm.ORDERS_DELETE.value).one()
        RolePermission.query.filter_by(role_id=role.id, permission_id=quote.id).delete()
        db.session.add(RolePermission(role_id=role.id, permission_id=delete.id))
        db.session.commit()
        before = _role_codes(OPERATOR_ROLE_NAME)

        report = seed_rbac()

        assert _role_codes(OPERATOR_ROLE_NAME) == before
        assert report.operator.role_created is False
        assert report.operator.missing_perms == [Perm.ORDERS_QUOTE.value]
        assert report.operator.extra_perms == [Perm.ORDERS_DELETE.value]


def test_members_removed_by_admin_are_not_re_added(app):
    with app.app_context():
        _add_users(("ana", "operator", False))
        seed_rbac()
        UserGroup.query.delete()
        db.session.commit()

        report = seed_rbac()

        assert UserGroup.query.count() == 0
        assert report.operator.members_added == []


# --- dry-run ---------------------------------------------------------------------------


def test_dry_run_reports_but_persists_nothing(app):
    with app.app_context():
        _add_users(("ana", "operator", False))
        report = seed_rbac(dry_run=True)
        assert len(report.catalog.created) == len(Perm)
        assert report.operator.role_created is True
        assert report.operator.members_added == ["ana"]
        db.session.remove()
        assert Permission.query.count() == 0
        assert Role.query.count() == 0
        assert Group.query.count() == 0
        assert UserGroup.query.count() == 0
