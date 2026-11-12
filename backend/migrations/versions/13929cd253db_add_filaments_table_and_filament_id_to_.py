"""add filaments table and filament_id to order_items

Revision ID: 13929cd253db
Revises: 2fb58e15f4f8
Create Date: 2026-09-15 15:52:44.630276

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from datetime import datetime, timezone

# revision identifiers, used by Alembic.
revision = '13929cd253db'
down_revision = '2fb58e15f4f8'
branch_labels = None
depends_on = None


def upgrade():
    filaments_table = op.create_table(
        'filaments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    # Default filaments: PLA and PETG
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        filaments_table,
        [
            {'id': 1, 'name': 'PLA', 'created_at': now},
            {'id': 2, 'name': 'PETG', 'created_at': now},
        ],
    )

    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('filament_id', sa.Integer(), nullable=True))
        batch_op.alter_column('material_id',
               existing_type=mysql.INTEGER(),
               nullable=True)
        batch_op.create_index('ix_order_items_filament_id', ['filament_id'], unique=False)
        batch_op.create_foreign_key('fk_order_items_filament_id', 'filaments', ['filament_id'], ['id'])


def downgrade():
    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.drop_constraint('fk_order_items_filament_id', type_='foreignkey')
        batch_op.drop_index('ix_order_items_filament_id')
        batch_op.alter_column('material_id',
               existing_type=mysql.INTEGER(),
               nullable=False)
        batch_op.drop_column('filament_id')

    op.drop_table('filaments')
