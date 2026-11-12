"""Servicios RBAC (rbac-access-control).

Etapa 3: sincronización del catálogo `Perm` -> tabla `permissions` y bootstrap del grupo
"Operadores" / rol "Operador". Todo en una sola transacción (`seed_rbac`), con dry-run.
"""

from dataclasses import dataclass, field

from app.auth.models import User
from app.extensions import db
from app.rbac.constants import (
    OPERATOR_GROUP_DESCRIPTION,
    OPERATOR_GROUP_NAME,
    OPERATOR_ROLE_DESCRIPTION,
    OPERATOR_ROLE_NAME,
    OPERATOR_ROLE_PERMS,
    PERM_DESCRIPTIONS,
    Perm,
)
from app.rbac.models import Group, GroupRole, Permission, Role, RolePermission, UserGroup

LEGACY_OPERATOR_ROLE = "operator"  # users.role (deprecada): solo para la membresía inicial


@dataclass(frozen=True)
class OrphanPermission:
    code: str
    roles: list[str]


@dataclass
class CatalogSyncReport:
    created: list[str] = field(default_factory=list)
    updated: list[str] = field(default_factory=list)
    unchanged: int = 0
    orphans: list[OrphanPermission] = field(default_factory=list)


@dataclass
class OperatorBootstrapReport:
    role_created: bool = False
    group_created: bool = False
    members_added: list[str] = field(default_factory=list)
    missing_perms: list[str] = field(default_factory=list)
    extra_perms: list[str] = field(default_factory=list)


@dataclass
class SeedReport:
    catalog: CatalogSyncReport
    operator: OperatorBootstrapReport
    dry_run: bool


def sync_permission_catalog() -> CatalogSyncReport:
    """Upsert por `code` (solo la descripción es actualizable) y lista los huérfanos.

    No hace commit: lo controla `seed_rbac`. Nunca borra permisos.
    """
    report = CatalogSyncReport()
    existing = {p.code: p for p in Permission.query.all()}

    for perm in Perm:
        description = PERM_DESCRIPTIONS[perm]
        row = existing.get(perm.value)
        if row is None:
            db.session.add(
                Permission(
                    code=perm.value,
                    resource=perm.resource,
                    action=perm.action,
                    description=description,
                )
            )
            report.created.append(perm.value)
        elif row.description != description:
            row.description = description
            report.updated.append(perm.value)
        else:
            report.unchanged += 1

    catalog_codes = {p.value for p in Perm}
    for code in sorted(set(existing) - catalog_codes):
        roles = (
            db.session.query(Role.name)
            .join(RolePermission, RolePermission.role_id == Role.id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .filter(Permission.code == code)
            .order_by(Role.name)
            .all()
        )
        report.orphans.append(OrphanPermission(code=code, roles=[name for (name,) in roles]))

    db.session.flush()
    return report


def _role_permission_codes(role_id: int) -> set[str]:
    rows = (
        db.session.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == role_id)
        .all()
    )
    return {code for (code,) in rows}


def bootstrap_operator_group() -> OperatorBootstrapReport:
    """Crea rol "Operador" y grupo "Operadores" solo si no existen.

    Si ya existen NO se modifican (la UI manda); se reporta la diferencia del rol contra
    OPERATOR_ROLE_PERMS. La membresía inicial (users.role = 'operator', no superusuarios)
    se carga solo al crear el grupo. Requiere el catálogo ya sincronizado. No hace commit.
    """
    report = OperatorBootstrapReport()
    expected = {p.value for p in OPERATOR_ROLE_PERMS}

    role = Role.query.filter_by(name=OPERATOR_ROLE_NAME).one_or_none()
    if role is None:
        role = Role(name=OPERATOR_ROLE_NAME, description=OPERATOR_ROLE_DESCRIPTION)
        db.session.add(role)
        db.session.flush()
        permissions = Permission.query.filter(Permission.code.in_(expected)).all()
        db.session.add_all(
            RolePermission(role_id=role.id, permission_id=p.id) for p in permissions
        )
        report.role_created = True
    else:
        current = _role_permission_codes(role.id)
        report.missing_perms = sorted(expected - current)
        report.extra_perms = sorted(current - expected)

    group = Group.query.filter_by(name=OPERATOR_GROUP_NAME).one_or_none()
    if group is None:
        group = Group(name=OPERATOR_GROUP_NAME, description=OPERATOR_GROUP_DESCRIPTION)
        db.session.add(group)
        db.session.flush()
        db.session.add(GroupRole(group_id=group.id, role_id=role.id))
        operators = (
            User.query.filter(
                User.role == LEGACY_OPERATOR_ROLE,
                User.is_superuser.is_(False),
            )
            .order_by(User.username)
            .all()
        )
        db.session.add_all(UserGroup(user_id=u.id, group_id=group.id) for u in operators)
        report.group_created = True
        report.members_added = [u.username for u in operators]

    db.session.flush()
    return report


def seed_rbac(dry_run: bool = False) -> SeedReport:
    """Catálogo + bootstrap en UNA transacción. dry_run=True -> rollback (no persiste nada)."""
    try:
        catalog = sync_permission_catalog()
        operator = bootstrap_operator_group()
        if dry_run:
            db.session.rollback()
        else:
            db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return SeedReport(catalog=catalog, operator=operator, dry_run=dry_run)
