"""Servicios RBAC (rbac-access-control).

Etapa 6: administración (/api/rbac): CRUD de grupos y roles, membresías, roles directos,
acceso efectivo, catálogo e impacto de quitar accesos (ver sección al final del módulo).
Etapa 5: `get_effective_permissions` (resolución por roles, una consulta UNION).
Etapa 3: sincronización del catálogo `Perm` -> tabla `permissions` y bootstrap del grupo
"Operadores" / rol "Operador". Todo en una sola transacción (`seed_rbac`), con dry-run.
"""

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased

from app.auth.models import User
from app.extensions import db
from app.rbac.constants import (
    OPERATOR_GROUP_DESCRIPTION,
    OPERATOR_GROUP_NAME,
    OPERATOR_ROLE_DESCRIPTION,
    OPERATOR_ROLE_NAME,
    OPERATOR_ROLE_PERMS,
    PERM_DESCRIPTIONS,
    RESOURCE_LABELS,
    Perm,
)
from app.rbac.models import Group, GroupRole, Permission, Role, RolePermission, UserGroup, UserRole

LEGACY_OPERATOR_ROLE = "operator"  # users.role (deprecada): solo para la membresía inicial


def get_effective_permissions(user_id: int) -> frozenset[str]:
    """Unión de los permisos de los roles del usuario por grupo y por asignación directa.

    Solo mira roles: NO aplica el bypass de superusuario (eso lo hace
    `app.rbac.security.get_user_permissions`). Una sola consulta (UNION); cada join usa el
    prefijo izquierdo de un UNIQUE de las tablas puente.
    """
    via_groups = (
        db.session.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(GroupRole, GroupRole.role_id == RolePermission.role_id)
        .join(UserGroup, UserGroup.group_id == GroupRole.group_id)
        .filter(UserGroup.user_id == user_id)
    )
    direct = (
        db.session.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .filter(UserRole.user_id == user_id)
    )
    return frozenset(code for (code,) in via_groups.union(direct).all())


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


# =========================================================================================
# Etapa 6 — administración (blueprint /api/rbac)
#
# Reglas (api-contract.md §0):
# - Orden de chequeo: NOT_FOUND (path) -> VALIDATION_ERROR -> NOT_FOUND (ids del body) ->
#   SELF_ASSIGNMENT / SELF_LOCKOUT -> conflictos (ALREADY_*, NAME_TAKEN, ROLE_IN_USE).
#   La validación del body la hace el route (schemas.py) entre `ensure_*_exists` y el service.
# - SELF_* se evalúan ANTES de escribir (simulación en memoria), así un 409 nunca deja
#   cambios a medias. Superusuarios: exentos de ambas reglas.
# - Auditoría: created_by / updated_by / assigned_by = actor (nunca del body).
# =========================================================================================

audit_logger = logging.getLogger("delivery3d.audit")

RBAC_MANAGE_CODE = Perm.RBAC_MANAGE.value


class RbacError(Exception):
    """Base de las excepciones de dominio de la administración RBAC."""

    message = "Error de administración de accesos"

    def __init__(self, message: str | None = None):
        super().__init__(message or self.message)
        self.message = message or self.message


class RbacNotFoundError(RbacError):
    message = "Recurso no encontrado"


class NameTakenError(RbacError):
    message = "El nombre ya está en uso"


class AlreadyMemberError(RbacError):
    message = "El usuario ya pertenece al grupo"


class AlreadyAssignedError(RbacError):
    message = "El rol ya está asignado"


class RoleInUseError(RbacError):
    message = "El rol está asignado a grupos o usuarios: desasignalo antes de borrarlo"


class SelfAssignmentError(RbacError):
    message = "No podés asignarte roles ni permisos a vos mismo"


class SelfLockoutError(RbacError):
    message = "No podés quitarte a vos mismo el permiso de administrar seguridad"


class UnknownPermissionError(RbacError):
    message = "Permisos desconocidos"

    def __init__(self, codes: list[str]):
        super().__init__()
        self.codes = codes


def _audit(event: str, actor: User, **fields) -> None:
    detail = " ".join(f"{k}={v}" for k, v in fields.items())
    audit_logger.info("%s actor_id=%s %s", event, actor.id, detail)


def _get(model, entity_id: int, message: str):
    entity = db.session.get(model, entity_id)
    if entity is None:
        raise RbacNotFoundError(message)
    return entity


def get_user(user_id: int) -> User:
    return _get(User, user_id, "Usuario no encontrado")


def get_group(group_id: int) -> Group:
    return _get(Group, group_id, "Grupo no encontrado")


def get_role(role_id: int) -> Role:
    return _get(Role, role_id, "Rol no encontrado")


def _like(column, q: str):
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return column.ilike(f"%{escaped}%", escape="\\")


def _count_of(model, fk_column, parent_id_column):
    return (
        db.select(db.func.count(model.id)).where(fk_column == parent_id_column).scalar_subquery()
    )


def _commit_or_conflict(conflict: RbacError) -> None:
    """Commit; si la base rechaza por UNIQUE (carrera entre dos requests) -> conflicto."""
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise conflict from None


# --- simulación de accesos (impacto + SELF_LOCKOUT) --------------------------------------


@dataclass(frozen=True)
class Grant:
    """Un rol que un usuario recibe: por grupo (`group_id`) o directo (`group_id=None`)."""

    role_id: int
    group_id: int | None


@dataclass
class AccessChange:
    """Cambio a simular: a quiénes afecta, qué grants pierden y qué roles cambian de permisos."""

    user_ids: set[int]
    drops: Callable[[int, Grant], bool] = lambda _uid, _grant: False
    role_overrides: dict[int, set[str]] = field(default_factory=dict)


def _grants_for(user_ids) -> dict[int, set[Grant]]:
    grants: dict[int, set[Grant]] = {uid: set() for uid in user_ids}
    if not grants:
        return grants
    via_groups = (
        db.session.query(UserGroup.user_id, GroupRole.group_id, GroupRole.role_id)
        .join(GroupRole, GroupRole.group_id == UserGroup.group_id)
        .filter(UserGroup.user_id.in_(grants))
        .all()
    )
    for user_id, group_id, role_id in via_groups:
        grants[user_id].add(Grant(role_id, group_id))
    direct = (
        db.session.query(UserRole.user_id, UserRole.role_id).filter(UserRole.user_id.in_(grants)).all()
    )
    for user_id, role_id in direct:
        grants[user_id].add(Grant(role_id, None))
    return grants


def _codes_by_role(role_ids) -> dict[int, set[str]]:
    codes: dict[int, set[str]] = {rid: set() for rid in role_ids}
    if not codes:
        return codes
    rows = (
        db.session.query(RolePermission.role_id, Permission.code)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .filter(RolePermission.role_id.in_(codes))
        .all()
    )
    for role_id, code in rows:
        codes[role_id].add(code)
    return codes


def _lost_permissions(change: AccessChange) -> dict[int, list[str]]:
    """Permisos que cada usuario afectado deja de tener (contempla las otras vías)."""
    grants = _grants_for(change.user_ids)
    role_ids = {g.role_id for gs in grants.values() for g in gs} | set(change.role_overrides)
    codes = _codes_by_role(role_ids)
    after_codes = {**codes, **change.role_overrides}

    lost: dict[int, list[str]] = {}
    for user_id, user_grants in grants.items():
        before = set().union(*(codes[g.role_id] for g in user_grants))
        after = set().union(
            *(after_codes[g.role_id] for g in user_grants if not change.drops(user_id, g))
        )
        lost[user_id] = sorted(before - after)
    return lost


def compute_impact(change: AccessChange, actor: User) -> dict:
    users = (
        User.query.filter(User.id.in_(change.user_ids)).order_by(User.username).all()
        if change.user_ids
        else []
    )
    simulated = _lost_permissions(change)
    # El superusuario conserva todo el catálogo: nunca pierde permisos.
    lost = {u.id: [] if u.is_superuser else simulated[u.id] for u in users}
    all_lost = {code for codes in lost.values() for code in codes}
    descriptions = dict(
        db.session.query(Permission.code, Permission.description)
        .filter(Permission.code.in_(all_lost))
        .all()
    ) if all_lost else {}
    affected = [
        {
            "id": u.id,
            "username": u.username,
            "lost_permissions": lost[u.id],
            "lost_permissions_detail": [
                {"code": code, "description": descriptions.get(code, "")} for code in lost[u.id]
            ],
        }
        for u in users
    ]
    own = next((a for a in affected if a["id"] == actor.id), None)
    return {
        "affected_users_count": len(affected),
        "users_losing_permissions_count": sum(1 for a in affected if a["lost_permissions"]),
        "affected_users": affected,
        "removes_own_rbac_manage": bool(
            own and not actor.is_superuser and RBAC_MANAGE_CODE in own["lost_permissions"]
        ),
    }


def _ensure_no_self_lockout(change: AccessChange, actor: User) -> None:
    if actor.is_superuser or actor.id not in change.user_ids:
        return
    own_change = AccessChange({actor.id}, change.drops, change.role_overrides)
    if RBAC_MANAGE_CODE in _lost_permissions(own_change)[actor.id]:
        raise SelfLockoutError()


def _ensure_not_self(user_id: int, actor: User) -> None:
    if user_id == actor.id and not actor.is_superuser:
        raise SelfAssignmentError()


def _member_ids(group_id: int) -> set[int]:
    return {uid for (uid,) in db.session.query(UserGroup.user_id).filter_by(group_id=group_id).all()}


def _role_holder_ids(role_id: int) -> set[int]:
    via_groups = (
        db.session.query(UserGroup.user_id)
        .join(GroupRole, GroupRole.group_id == UserGroup.group_id)
        .filter(GroupRole.role_id == role_id)
    )
    direct = db.session.query(UserRole.user_id).filter(UserRole.role_id == role_id)
    return {uid for (uid,) in via_groups.union(direct).all()}


def _membership(group_id: int, user_id: int) -> UserGroup:
    row = UserGroup.query.filter_by(group_id=group_id, user_id=user_id).one_or_none()
    if row is None:
        raise RbacNotFoundError("El usuario no pertenece al grupo")
    return row


def _group_role(group_id: int, role_id: int) -> GroupRole:
    row = GroupRole.query.filter_by(group_id=group_id, role_id=role_id).one_or_none()
    if row is None:
        raise RbacNotFoundError("El rol no está asignado al grupo")
    return row


def _direct_role(user_id: int, role_id: int) -> UserRole:
    row = UserRole.query.filter_by(user_id=user_id, role_id=role_id).one_or_none()
    if row is None:
        raise RbacNotFoundError("El usuario no tiene ese rol asignado")
    return row


def _member_removal(group_id: int, user_id: int) -> AccessChange:
    get_group(group_id)
    get_user(user_id)
    _membership(group_id, user_id)
    return AccessChange({user_id}, lambda uid, g: uid == user_id and g.group_id == group_id)


def _group_role_removal(group_id: int, role_id: int) -> AccessChange:
    get_group(group_id)
    get_role(role_id)
    _group_role(group_id, role_id)
    return AccessChange(
        _member_ids(group_id), lambda _uid, g: g.group_id == group_id and g.role_id == role_id
    )


def _direct_role_removal(user_id: int, role_id: int) -> AccessChange:
    get_user(user_id)
    get_role(role_id)
    _direct_role(user_id, role_id)
    return AccessChange(
        {user_id}, lambda uid, g: uid == user_id and g.group_id is None and g.role_id == role_id
    )


def _group_deletion(group_id: int) -> AccessChange:
    get_group(group_id)
    return AccessChange(_member_ids(group_id), lambda _uid, g: g.group_id == group_id)


def _role_deletion(role_id: int) -> AccessChange:
    get_role(role_id)
    return AccessChange(_role_holder_ids(role_id), lambda _uid, g: g.role_id == role_id)


def _permissions_change(role_id: int, codes: set[str]) -> AccessChange:
    return AccessChange(_role_holder_ids(role_id), role_overrides={role_id: codes})


def member_removal_impact(group_id: int, user_id: int, actor: User) -> dict:
    return compute_impact(_member_removal(group_id, user_id), actor)


def group_role_removal_impact(group_id: int, role_id: int, actor: User) -> dict:
    return compute_impact(_group_role_removal(group_id, role_id), actor)


def direct_role_removal_impact(user_id: int, role_id: int, actor: User) -> dict:
    return compute_impact(_direct_role_removal(user_id, role_id), actor)


def group_deletion_impact(group_id: int, actor: User) -> dict:
    return compute_impact(_group_deletion(group_id), actor)


def role_deletion_impact(role_id: int, actor: User) -> dict:
    return compute_impact(_role_deletion(role_id), actor)


def permissions_change_impact(role_id: int, codes: list[str], actor: User) -> dict:
    get_role(role_id)
    return compute_impact(_permissions_change(role_id, _resolve_permissions(codes)[0]), actor)


# --- usuarios ---------------------------------------------------------------------------


def list_users(q: str | None) -> list[dict]:
    groups_count = _count_of(UserGroup, UserGroup.user_id, User.id)
    roles_count = _count_of(UserRole, UserRole.user_id, User.id)
    query = db.session.query(User, groups_count, roles_count)
    if q:
        query = query.filter(_like(User.username, q))
    return [
        {
            "id": u.id,
            "username": u.username,
            "is_active": u.is_active,
            "is_superuser": u.is_superuser,
            "groups_count": gc,
            "direct_roles_count": rc,
        }
        for u, gc, rc in query.order_by(User.username).all()
    ]


def list_user_groups(user_id: int) -> list[Group]:
    get_user(user_id)
    return (
        Group.query.join(UserGroup, UserGroup.group_id == Group.id)
        .filter(UserGroup.user_id == user_id)
        .order_by(Group.name)
        .all()
    )


def list_direct_roles(user_id: int) -> list[tuple[UserRole, Role, User | None]]:
    get_user(user_id)
    assigner = aliased(User)
    return (
        db.session.query(UserRole, Role, assigner)
        .join(Role, Role.id == UserRole.role_id)
        .outerjoin(assigner, assigner.id == UserRole.assigned_by)
        .filter(UserRole.user_id == user_id)
        .order_by(Role.name)
        .all()
    )


def _add_membership(group_id: int, user_id: int, actor: User) -> None:
    get_group(group_id)
    get_user(user_id)
    _ensure_not_self(user_id, actor)
    if UserGroup.query.filter_by(group_id=group_id, user_id=user_id).first() is not None:
        raise AlreadyMemberError()
    db.session.add(
        UserGroup(user_id=user_id, group_id=group_id, created_by=actor.id, updated_by=actor.id)
    )
    _commit_or_conflict(AlreadyMemberError())
    _audit("rbac_member_added", actor, group_id=group_id, user_id=user_id)


def _remove_membership(group_id: int, user_id: int, actor: User) -> None:
    _ensure_no_self_lockout(_member_removal(group_id, user_id), actor)
    db.session.delete(_membership(group_id, user_id))
    db.session.commit()
    _audit("rbac_member_removed", actor, group_id=group_id, user_id=user_id)


def add_user_to_group(user_id: int, group_id: int, actor: User) -> dict:
    _add_membership(group_id, user_id, actor)
    return {"user_id": user_id, "group_id": group_id}


def remove_user_from_group(user_id: int, group_id: int, actor: User) -> None:
    _remove_membership(group_id, user_id, actor)


def assign_direct_role(user_id: int, role_id: int, reason: str, actor: User):
    get_user(user_id)
    role = get_role(role_id)
    _ensure_not_self(user_id, actor)
    if UserRole.query.filter_by(user_id=user_id, role_id=role_id).first() is not None:
        raise AlreadyAssignedError("El rol ya está asignado al usuario")
    assignment = UserRole(
        user_id=user_id, role_id=role_id, reason=reason, assigned_by=actor.id, updated_by=actor.id
    )
    db.session.add(assignment)
    _commit_or_conflict(AlreadyAssignedError("El rol ya está asignado al usuario"))
    _audit("rbac_direct_role_assigned", actor, user_id=user_id, role_id=role_id)
    return assignment, role, actor


def remove_direct_role(user_id: int, role_id: int, actor: User) -> None:
    _ensure_no_self_lockout(_direct_role_removal(user_id, role_id), actor)
    db.session.delete(_direct_role(user_id, role_id))
    db.session.commit()
    _audit("rbac_direct_role_removed", actor, user_id=user_id, role_id=role_id)


def get_user_access(user_id: int) -> dict:
    """Roles del usuario con su origen y permisos efectivos con sus fuentes (contrato §2)."""
    user = get_user(user_id)
    group_rows = (
        db.session.query(Role.id, Role.name, Group.id, Group.name)
        .join(GroupRole, GroupRole.role_id == Role.id)
        .join(Group, Group.id == GroupRole.group_id)
        .join(UserGroup, UserGroup.group_id == Group.id)
        .filter(UserGroup.user_id == user_id)
        .order_by(Group.name, Role.name)
        .all()
    )
    direct_rows = list_direct_roles(user_id)

    roles: dict[int, dict] = {}

    def entry(role_id: int, role_name: str) -> dict:
        return roles.setdefault(
            role_id, {"role": {"id": role_id, "name": role_name}, "sources": []}
        )

    for role_id, role_name, group_id, group_name in group_rows:
        entry(role_id, role_name)["sources"].append(
            {"type": "group", "group": {"id": group_id, "name": group_name}}
        )
    for assignment, role, assigner in sorted(direct_rows, key=lambda r: r[1].name):
        entry(role.id, role.name)["sources"].append(
            {
                "type": "direct",
                "reason": assignment.reason,
                "assigned_by": None if assigner is None else {"id": assigner.id, "username": assigner.username},
                "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
            }
        )

    if user.is_superuser:
        permissions = [
            {
                "code": p.value,
                "resource": p.resource,
                "action": p.action,
                "description": PERM_DESCRIPTIONS[p],
                "sources": [{"type": "superuser"}],
            }
            for p in sorted(Perm, key=lambda p: p.value)
        ]
    else:
        permissions = _permissions_with_sources(group_rows, direct_rows, set(roles))

    return {
        "user_id": user.id,
        "username": user.username,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "roles": sorted(roles.values(), key=lambda r: (r["role"]["name"], r["role"]["id"])),
        "permissions": permissions,
    }


def _permissions_with_sources(group_rows, direct_rows, role_ids: set[int]) -> list[dict]:
    if not role_ids:
        return []
    perm_rows = (
        db.session.query(RolePermission.role_id, Permission)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .filter(RolePermission.role_id.in_(role_ids))
        .all()
    )
    perms_by_role: dict[int, list[Permission]] = {}
    for role_id, perm in perm_rows:
        perms_by_role.setdefault(role_id, []).append(perm)

    by_code: dict[str, dict] = {}

    def add(perm: Permission, source: dict) -> None:
        by_code.setdefault(
            perm.code,
            {
                "code": perm.code,
                "resource": perm.resource,
                "action": perm.action,
                "description": perm.description,
                "sources": [],
            },
        )["sources"].append(source)

    for role_id, role_name, group_id, group_name in group_rows:  # ya ordenadas por grupo, rol
        for perm in perms_by_role.get(role_id, []):
            add(perm, {"type": "group", "group": {"id": group_id, "name": group_name},
                       "role": {"id": role_id, "name": role_name}})
    for _assignment, role, _assigner in sorted(direct_rows, key=lambda r: r[1].name):
        for perm in perms_by_role.get(role.id, []):
            add(perm, {"type": "direct", "role": {"id": role.id, "name": role.name}})

    return [by_code[code] for code in sorted(by_code)]


# --- grupos -----------------------------------------------------------------------------


def list_groups(q: str | None) -> list[dict]:
    members_count = _count_of(UserGroup, UserGroup.group_id, Group.id)
    roles_count = _count_of(GroupRole, GroupRole.group_id, Group.id)
    query = db.session.query(Group, members_count, roles_count)
    if q:
        query = query.filter(_like(Group.name, q))
    return [
        {"id": g.id, "name": g.name, "description": g.description, "members_count": mc, "roles_count": rc}
        for g, mc, rc in query.order_by(Group.name).all()
    ]


def list_group_members(group_id: int) -> list[User]:
    get_group(group_id)
    return (
        User.query.join(UserGroup, UserGroup.user_id == User.id)
        .filter(UserGroup.group_id == group_id)
        .order_by(User.username)
        .all()
    )


def list_group_roles(group_id: int) -> list[Role]:
    get_group(group_id)
    return (
        Role.query.join(GroupRole, GroupRole.role_id == Role.id)
        .filter(GroupRole.group_id == group_id)
        .order_by(Role.name)
        .all()
    )


def group_with_content(group_id: int) -> tuple[Group, list[User], list[Role]]:
    group = get_group(group_id)
    return group, list_group_members(group_id), list_group_roles(group_id)


def _ensure_name_free(model, name: str, exclude_id: int | None, message: str) -> None:
    # La collation utf8mb4_unicode_ci compara sin distinguir mayúsculas, igual que el UNIQUE.
    query = model.query.filter(model.name == name)
    if exclude_id is not None:
        query = query.filter(model.id != exclude_id)
    if query.first() is not None:
        raise NameTakenError(message)


GROUP_NAME_TAKEN = "Ya existe un grupo con ese nombre"
ROLE_NAME_TAKEN = "Ya existe un rol con ese nombre"


def create_group(name: str, description: str | None, actor: User) -> Group:
    _ensure_name_free(Group, name, None, GROUP_NAME_TAKEN)
    group = Group(name=name, description=description, created_by=actor.id, updated_by=actor.id)
    db.session.add(group)
    _commit_or_conflict(NameTakenError(GROUP_NAME_TAKEN))
    _audit("rbac_group_created", actor, group_id=group.id)
    return group


def update_group(group_id: int, name: str, description: str | None, actor: User) -> Group:
    group = get_group(group_id)
    _ensure_name_free(Group, name, group_id, GROUP_NAME_TAKEN)
    group.name, group.description, group.updated_by = name, description, actor.id
    _commit_or_conflict(NameTakenError(GROUP_NAME_TAKEN))
    _audit("rbac_group_updated", actor, group_id=group_id)
    return group


def delete_group(group_id: int, actor: User) -> None:
    change = _group_deletion(group_id)
    _ensure_no_self_lockout(change, actor)
    # ON DELETE CASCADE en user_groups.group_id y group_roles.group_id.
    Group.query.filter_by(id=group_id).delete()
    db.session.commit()
    _audit("rbac_group_deleted", actor, group_id=group_id, affected_users=len(change.user_ids))


def add_group_member(group_id: int, user_id: int, actor: User) -> None:
    _add_membership(group_id, user_id, actor)


def remove_group_member(group_id: int, user_id: int, actor: User) -> None:
    _remove_membership(group_id, user_id, actor)


def add_group_role(group_id: int, role_id: int, actor: User) -> None:
    get_group(group_id)
    get_role(role_id)
    if not actor.is_superuser and actor.id in _member_ids(group_id):
        raise SelfAssignmentError()
    if GroupRole.query.filter_by(group_id=group_id, role_id=role_id).first() is not None:
        raise AlreadyAssignedError("El rol ya está asignado al grupo")
    db.session.add(
        GroupRole(group_id=group_id, role_id=role_id, created_by=actor.id, updated_by=actor.id)
    )
    _commit_or_conflict(AlreadyAssignedError("El rol ya está asignado al grupo"))
    _audit("rbac_group_role_added", actor, group_id=group_id, role_id=role_id)


def remove_group_role(group_id: int, role_id: int, actor: User) -> None:
    _ensure_no_self_lockout(_group_role_removal(group_id, role_id), actor)
    db.session.delete(_group_role(group_id, role_id))
    db.session.commit()
    _audit("rbac_group_role_removed", actor, group_id=group_id, role_id=role_id)


# --- roles ------------------------------------------------------------------------------


def list_roles(q: str | None) -> list[dict]:
    perms_count = _count_of(RolePermission, RolePermission.role_id, Role.id)
    groups_count = _count_of(GroupRole, GroupRole.role_id, Role.id)
    users_count = _count_of(UserRole, UserRole.role_id, Role.id)
    query = db.session.query(Role, perms_count, groups_count, users_count)
    if q:
        query = query.filter(_like(Role.name, q))
    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "permissions_count": pc,
            "groups_count": gc,
            "direct_users_count": uc,
        }
        for r, pc, gc, uc in query.order_by(Role.name).all()
    ]


def role_with_permissions(role_id: int) -> tuple[Role, set[str]]:
    role = get_role(role_id)
    return role, _role_permission_codes(role_id)


def create_role(name: str, description: str | None, actor: User) -> Role:
    _ensure_name_free(Role, name, None, ROLE_NAME_TAKEN)
    role = Role(name=name, description=description, created_by=actor.id, updated_by=actor.id)
    db.session.add(role)
    _commit_or_conflict(NameTakenError(ROLE_NAME_TAKEN))
    _audit("rbac_role_created", actor, role_id=role.id)
    return role


def update_role(role_id: int, name: str, description: str | None, actor: User) -> Role:
    role = get_role(role_id)
    _ensure_name_free(Role, name, role_id, ROLE_NAME_TAKEN)
    role.name, role.description, role.updated_by = name, description, actor.id
    _commit_or_conflict(NameTakenError(ROLE_NAME_TAKEN))
    _audit("rbac_role_updated", actor, role_id=role_id)
    return role


def delete_role(role_id: int, actor: User) -> None:
    """Un rol en uso no se borra (ROLE_IN_USE). Como uno sin uso no lo tiene nadie, borrarlo
    no le quita nada a nadie: acá nunca aplica SELF_LOCKOUT."""
    get_role(role_id)
    in_use = (
        GroupRole.query.filter_by(role_id=role_id).first() is not None
        or UserRole.query.filter_by(role_id=role_id).first() is not None
    )
    if in_use:
        raise RoleInUseError()
    # ON DELETE CASCADE en role_permissions.role_id.
    Role.query.filter_by(id=role_id).delete()
    db.session.commit()
    _audit("rbac_role_deleted", actor, role_id=role_id)


def _resolve_permissions(codes: list[str]) -> tuple[set[str], list[Permission]]:
    """Valida contra el catálogo (`Perm` y tabla `permissions`). Desconocidos -> 422."""
    catalog = {p.value for p in Perm}
    rows = Permission.query.filter(Permission.code.in_(codes)).all() if codes else []
    known = {p.code for p in rows} & catalog
    unknown = [c for c in codes if c not in known]
    if unknown:
        raise UnknownPermissionError(unknown)
    return set(codes), [p for p in rows if p.code in known]


def set_role_permissions(role_id: int, codes: list[str], actor: User) -> tuple[Role, set[str]]:
    role = get_role(role_id)
    new_codes, permissions = _resolve_permissions(codes)
    current = _role_permission_codes(role_id)

    change = _permissions_change(role_id, new_codes)
    if not actor.is_superuser and actor.id in change.user_ids and new_codes - current:
        raise SelfAssignmentError()
    _ensure_no_self_lockout(change, actor)

    by_code = {p.code: p for p in permissions}
    removed_ids = db.select(Permission.id).where(Permission.code.in_(current - new_codes))
    RolePermission.query.filter(
        RolePermission.role_id == role_id, RolePermission.permission_id.in_(removed_ids)
    ).delete(synchronize_session=False)
    db.session.add_all(
        RolePermission(
            role_id=role_id, permission_id=by_code[code].id, created_by=actor.id, updated_by=actor.id
        )
        for code in sorted(new_codes - current)
    )
    role.updated_by = actor.id
    role.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    _audit(
        "rbac_role_permissions_set", actor, role_id=role_id,
        added=",".join(sorted(new_codes - current)) or "-",
        removed=",".join(sorted(current - new_codes)) or "-",
    )
    return role, new_codes


# --- catálogo ---------------------------------------------------------------------------


def permission_catalog() -> list[dict]:
    rows = (
        db.session.query(Permission.code, Role.id, Role.name)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .order_by(Role.name)
        .all()
    )
    roles_by_code: dict[str, list[dict]] = {}
    for code, role_id, role_name in rows:
        roles_by_code.setdefault(code, []).append({"id": role_id, "name": role_name})

    return [
        {
            "resource": resource,
            "resource_label": label,
            "permissions": [
                {
                    "code": p.value,
                    "action": p.action,
                    "description": PERM_DESCRIPTIONS[p],
                    "roles": roles_by_code.get(p.value, []),
                }
                for p in Perm
                if p.resource == resource
            ],
        }
        for resource, label in RESOURCE_LABELS.items()
    ]
