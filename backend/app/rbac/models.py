"""RBAC mixto (rbac-access-control, etapa 2).

Permisos -> roles (role_permissions). Usuarios obtienen roles por grupo
(user_groups -> groups -> group_roles) o directo (user_roles, excepciones con motivo).

IMPORTANTE: los tests crean el esquema con `db.create_all()`; índices, CHECK y ondelete
declarados acá deben coincidir 1:1 con la migración `44a4db68ccde_add_rbac_tables`.

Auditoría: created_by / updated_by / assigned_by son NULL cuando la fila la crea una
migración o un seed ("sistema"); ON DELETE RESTRICT para no perder la autoría.
"""

from datetime import datetime, timezone

from app.extensions import db


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _timestamp(onupdate: bool = False) -> db.Column:
    return db.Column(
        db.DateTime,
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow if onupdate else None,
        server_default=db.text("CURRENT_TIMESTAMP"),
    )


def _audit_user_fk(table: str, column: str) -> db.Column:
    """FK nullable a users.id, ON DELETE RESTRICT (NULL = sistema)."""
    return db.Column(
        db.Integer,
        db.ForeignKey("users.id", name=f"fk_{table}_{column}", ondelete="RESTRICT"),
        nullable=True,
    )


def _fk(table: str, column: str, target: str, ondelete: str) -> db.Column:
    return db.Column(
        db.Integer,
        db.ForeignKey(f"{target}.id", name=f"fk_{table}_{column}", ondelete=ondelete),
        nullable=False,
    )


class Group(db.Model):
    __tablename__ = "groups"  # palabra reservada en MySQL 8: usar backticks en SQL crudo

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    created_at = _timestamp()
    updated_at = _timestamp(onupdate=True)
    created_by = _audit_user_fk("groups", "created_by")
    updated_by = _audit_user_fk("groups", "updated_by")

    __table_args__ = (
        db.UniqueConstraint("name", name="uq_groups_name"),
        db.Index("ix_groups_created_by", "created_by"),
        db.Index("ix_groups_updated_by", "updated_by"),
    )


class Role(db.Model):
    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    created_at = _timestamp()
    updated_at = _timestamp(onupdate=True)
    created_by = _audit_user_fk("roles", "created_by")
    updated_by = _audit_user_fk("roles", "updated_by")

    __table_args__ = (
        db.UniqueConstraint("name", name="uq_roles_name"),
        db.Index("ix_roles_created_by", "created_by"),
        db.Index("ix_roles_updated_by", "updated_by"),
    )


class Permission(db.Model):
    """Catálogo sincronizado desde `app.rbac.constants.Perm` por seed. `code` es inmutable."""

    __tablename__ = "permissions"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    code = db.Column(db.String(100), nullable=False)
    resource = db.Column(db.String(50), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(255), nullable=False)
    created_at = _timestamp()

    __table_args__ = (
        db.UniqueConstraint("code", name="uq_permissions_code"),
        db.UniqueConstraint("resource", "action", name="uq_permissions_resource_action"),
        db.CheckConstraint(
            "code = CONCAT(resource, ':', action)", name="chk_permissions_code_matches"
        ),
    )


class UserGroup(db.Model):
    __tablename__ = "user_groups"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = _fk("user_groups", "user_id", "users", "CASCADE")
    group_id = _fk("user_groups", "group_id", "groups", "CASCADE")
    created_at = _timestamp()
    updated_at = _timestamp(onupdate=True)
    created_by = _audit_user_fk("user_groups", "created_by")
    updated_by = _audit_user_fk("user_groups", "updated_by")

    __table_args__ = (
        db.UniqueConstraint("user_id", "group_id", name="uq_user_groups_user_id_group_id"),
        db.Index("ix_user_groups_group_id", "group_id"),
        db.Index("ix_user_groups_created_by", "created_by"),
        db.Index("ix_user_groups_updated_by", "updated_by"),
    )


class GroupRole(db.Model):
    __tablename__ = "group_roles"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    group_id = _fk("group_roles", "group_id", "groups", "CASCADE")
    role_id = _fk("group_roles", "role_id", "roles", "RESTRICT")
    created_at = _timestamp()
    updated_at = _timestamp(onupdate=True)
    created_by = _audit_user_fk("group_roles", "created_by")
    updated_by = _audit_user_fk("group_roles", "updated_by")

    __table_args__ = (
        db.UniqueConstraint("group_id", "role_id", name="uq_group_roles_group_id_role_id"),
        db.Index("ix_group_roles_role_id", "role_id"),
        db.Index("ix_group_roles_created_by", "created_by"),
        db.Index("ix_group_roles_updated_by", "updated_by"),
    )


class UserRole(db.Model):
    """Asignación directa (excepción). assigned_at/assigned_by hacen de created_at/created_by.

    La regla "nadie se asigna roles a sí mismo" se valida en services (MySQL 8 no permite
    un CHECK sobre user_id porque participa de una FK con ON DELETE CASCADE, error 3823).
    """

    __tablename__ = "user_roles"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = _fk("user_roles", "user_id", "users", "CASCADE")
    role_id = _fk("user_roles", "role_id", "roles", "RESTRICT")
    reason = db.Column(db.String(255), nullable=False)
    assigned_at = _timestamp()
    assigned_by = _audit_user_fk("user_roles", "assigned_by")
    updated_at = _timestamp(onupdate=True)
    updated_by = _audit_user_fk("user_roles", "updated_by")

    __table_args__ = (
        db.UniqueConstraint("user_id", "role_id", name="uq_user_roles_user_id_role_id"),
        db.CheckConstraint("CHAR_LENGTH(TRIM(reason)) > 0", name="chk_user_roles_reason_not_blank"),
        db.Index("ix_user_roles_role_id", "role_id"),
        db.Index("ix_user_roles_assigned_by", "assigned_by"),
        db.Index("ix_user_roles_updated_by", "updated_by"),
    )


class RolePermission(db.Model):
    __tablename__ = "role_permissions"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    role_id = _fk("role_permissions", "role_id", "roles", "CASCADE")
    permission_id = _fk("role_permissions", "permission_id", "permissions", "RESTRICT")
    created_at = _timestamp()
    updated_at = _timestamp(onupdate=True)
    created_by = _audit_user_fk("role_permissions", "created_by")
    updated_by = _audit_user_fk("role_permissions", "updated_by")

    __table_args__ = (
        db.UniqueConstraint(
            "role_id", "permission_id", name="uq_role_permissions_role_id_permission_id"
        ),
        db.Index("ix_role_permissions_permission_id", "permission_id"),
        db.Index("ix_role_permissions_created_by", "created_by"),
        db.Index("ix_role_permissions_updated_by", "updated_by"),
    )
