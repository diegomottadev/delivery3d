"""add_rbac_tables (rbac-access-control, etapa 2)

- users: + is_superuser (backfill: role = 'admin' -> 1), + updated_at (backfill = created_at).
  users.role se conserva DEPRECADA (no se usa para autorizar).
- Tablas nuevas: groups, roles, permissions, user_groups, group_roles, user_roles,
  role_permissions.

Debe coincidir 1:1 con app/rbac/models.py y app/auth/models.py (los tests usan create_all).

Revision ID: 44a4db68ccde
Revises: c8c9b0e3a953
Create Date: 2026-11-12 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '44a4db68ccde'
down_revision = 'c8c9b0e3a953'
branch_labels = None
depends_on = None


def _ts(name):
    return sa.Column(name, sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'))


def _audit_fk(table, column):
    return [
        sa.Column(column, sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            [column], ['users.id'], name=f'fk_{table}_{column}', ondelete='RESTRICT'
        ),
    ]


def _fk(table, column, target, ondelete):
    return [
        sa.Column(column, sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            [column], [f'{target}.id'], name=f'fk_{table}_{column}', ondelete=ondelete
        ),
    ]


def upgrade():
    # --- users -------------------------------------------------------------------------
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('is_superuser', sa.Boolean(), nullable=False, server_default=sa.text('0'))
        )
        batch_op.add_column(
            sa.Column(
                'updated_at', sa.DateTime(), nullable=False,
                server_default=sa.text('CURRENT_TIMESTAMP'),
            )
        )
    # Migración de datos (P1 opción a): admin -> superusuario; operator queda en 0.
    op.execute("UPDATE users SET is_superuser = 1 WHERE role = 'admin'")
    # P2: backfill updated_at = created_at.
    op.execute("UPDATE users SET updated_at = created_at")

    # --- catálogos ---------------------------------------------------------------------
    op.create_table(
        'groups',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        _ts('created_at'),
        _ts('updated_at'),
        *_audit_fk('groups', 'created_by'),
        *_audit_fk('groups', 'updated_by'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_groups_name'),
    )
    op.create_index('ix_groups_created_by', 'groups', ['created_by'])
    op.create_index('ix_groups_updated_by', 'groups', ['updated_by'])

    op.create_table(
        'roles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        _ts('created_at'),
        _ts('updated_at'),
        *_audit_fk('roles', 'created_by'),
        *_audit_fk('roles', 'updated_by'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_roles_name'),
    )
    op.create_index('ix_roles_created_by', 'roles', ['created_by'])
    op.create_index('ix_roles_updated_by', 'roles', ['updated_by'])

    op.create_table(
        'permissions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('resource', sa.String(length=50), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=False),
        _ts('created_at'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_permissions_code'),
        sa.UniqueConstraint('resource', 'action', name='uq_permissions_resource_action'),
        sa.CheckConstraint(
            "code = CONCAT(resource, ':', action)", name='chk_permissions_code_matches'
        ),
    )

    # --- tablas puente -----------------------------------------------------------------
    op.create_table(
        'user_groups',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        *_fk('user_groups', 'user_id', 'users', 'CASCADE'),
        *_fk('user_groups', 'group_id', 'groups', 'CASCADE'),
        _ts('created_at'),
        _ts('updated_at'),
        *_audit_fk('user_groups', 'created_by'),
        *_audit_fk('user_groups', 'updated_by'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'group_id', name='uq_user_groups_user_id_group_id'),
    )
    op.create_index('ix_user_groups_group_id', 'user_groups', ['group_id'])
    op.create_index('ix_user_groups_created_by', 'user_groups', ['created_by'])
    op.create_index('ix_user_groups_updated_by', 'user_groups', ['updated_by'])

    op.create_table(
        'group_roles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        *_fk('group_roles', 'group_id', 'groups', 'CASCADE'),
        *_fk('group_roles', 'role_id', 'roles', 'RESTRICT'),
        _ts('created_at'),
        _ts('updated_at'),
        *_audit_fk('group_roles', 'created_by'),
        *_audit_fk('group_roles', 'updated_by'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('group_id', 'role_id', name='uq_group_roles_group_id_role_id'),
    )
    op.create_index('ix_group_roles_role_id', 'group_roles', ['role_id'])
    op.create_index('ix_group_roles_created_by', 'group_roles', ['created_by'])
    op.create_index('ix_group_roles_updated_by', 'group_roles', ['updated_by'])

    op.create_table(
        'user_roles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        *_fk('user_roles', 'user_id', 'users', 'CASCADE'),
        *_fk('user_roles', 'role_id', 'roles', 'RESTRICT'),
        sa.Column('reason', sa.String(length=255), nullable=False),
        _ts('assigned_at'),
        *_audit_fk('user_roles', 'assigned_by'),
        _ts('updated_at'),
        *_audit_fk('user_roles', 'updated_by'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'role_id', name='uq_user_roles_user_id_role_id'),
        sa.CheckConstraint(
            'CHAR_LENGTH(TRIM(reason)) > 0', name='chk_user_roles_reason_not_blank'
        ),
    )
    op.create_index('ix_user_roles_role_id', 'user_roles', ['role_id'])
    op.create_index('ix_user_roles_assigned_by', 'user_roles', ['assigned_by'])
    op.create_index('ix_user_roles_updated_by', 'user_roles', ['updated_by'])

    op.create_table(
        'role_permissions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        *_fk('role_permissions', 'role_id', 'roles', 'CASCADE'),
        *_fk('role_permissions', 'permission_id', 'permissions', 'RESTRICT'),
        _ts('created_at'),
        _ts('updated_at'),
        *_audit_fk('role_permissions', 'created_by'),
        *_audit_fk('role_permissions', 'updated_by'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'role_id', 'permission_id', name='uq_role_permissions_role_id_permission_id'
        ),
    )
    op.create_index('ix_role_permissions_permission_id', 'role_permissions', ['permission_id'])
    op.create_index('ix_role_permissions_created_by', 'role_permissions', ['created_by'])
    op.create_index('ix_role_permissions_updated_by', 'role_permissions', ['updated_by'])


def downgrade():
    # Orden inverso: puentes -> catálogos -> columnas de users.
    # Las tablas se borran con sus índices; users.role nunca se tocó, así que
    # is_superuser se puede reconstruir desde role si se vuelve a subir.
    op.drop_table('role_permissions')
    op.drop_table('user_roles')
    op.drop_table('group_roles')
    op.drop_table('user_groups')
    op.drop_table('permissions')
    op.drop_table('roles')
    op.drop_table('groups')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('updated_at')
        batch_op.drop_column('is_superuser')
