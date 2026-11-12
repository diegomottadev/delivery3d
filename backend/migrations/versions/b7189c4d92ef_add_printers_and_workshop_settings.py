"""add printers and workshop_settings tables and printer_id to order_quotes

Revision ID: b7189c4d92ef
Revises: 13929cd253db
Create Date: 2026-09-15 18:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone

# revision identifiers, used by Alembic.
revision = 'b7189c4d92ef'
down_revision = '13929cd253db'
branch_labels = None
depends_on = None


def upgrade():
    now = datetime.now(timezone.utc)

    # 1. Create printers table
    printers_table = op.create_table(
        'printers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=True),
        sa.Column('power_watts', sa.Numeric(precision=8, scale=2), nullable=False),
        sa.Column('cost_per_hour', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint('power_watts > 0', name='chk_printers_power_watts'),
        sa.CheckConstraint('cost_per_hour >= 0', name='chk_printers_cost_per_hour'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index('ix_printers_is_active', 'printers', ['is_active'], unique=False)

    # Seed initial printers
    op.bulk_insert(
        printers_table,
        [
            {
                'id': 1,
                'name': 'Bambu Lab A1',
                'model': 'A1',
                'power_watts': 120.00,
                'cost_per_hour': 100.00,
                'is_active': True,
                'created_at': now,
                'updated_at': now,
            },
            {
                'id': 2,
                'name': 'Bambu Lab P1S',
                'model': 'P1S',
                'power_watts': 160.00,
                'cost_per_hour': 150.00,
                'is_active': True,
                'created_at': now,
                'updated_at': now,
            },
            {
                'id': 3,
                'name': 'Creality Ender 3',
                'model': 'Ender 3',
                'power_watts': 150.00,
                'cost_per_hour': 80.00,
                'is_active': True,
                'created_at': now,
                'updated_at': now,
            },
        ],
    )

    # 2. Create workshop_settings table
    workshop_settings_table = op.create_table(
        'workshop_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('kwh_cost', sa.Numeric(precision=10, scale=2), nullable=False, server_default='278.00'),
        sa.Column('waste_purge_pct', sa.Numeric(precision=5, scale=2), nullable=False, server_default='10.00'),
        sa.Column('labor_cost', sa.Numeric(precision=10, scale=2), nullable=False, server_default='1500.00'),
        sa.Column('profit_multiplier', sa.Numeric(precision=4, scale=2), nullable=False, server_default='2.00'),
        sa.Column('default_printer_id', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint('kwh_cost >= 0', name='chk_workshop_settings_kwh'),
        sa.CheckConstraint('waste_purge_pct >= 0', name='chk_workshop_settings_waste'),
        sa.CheckConstraint('labor_cost >= 0', name='chk_workshop_settings_labor'),
        sa.CheckConstraint('profit_multiplier >= 1', name='chk_workshop_settings_multiplier'),
        sa.ForeignKeyConstraint(['default_printer_id'], ['printers.id'], ondelete='SET NULL', name='fk_workshop_settings_printer'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Seed default workshop settings
    op.bulk_insert(
        workshop_settings_table,
        [
            {
                'id': 1,
                'kwh_cost': 278.00,
                'waste_purge_pct': 10.00,
                'labor_cost': 1500.00,
                'profit_multiplier': 2.00,
                'default_printer_id': 1,
                'updated_at': now,
            }
        ],
    )

    # 3. Add printer_id to order_quotes
    with op.batch_alter_table('order_quotes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('printer_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_order_quotes_printer_id', ['printer_id'], unique=False)
        batch_op.create_foreign_key('fk_order_quotes_printer_id', 'printers', ['printer_id'], ['id'], ondelete='SET NULL')

    # Update existing quotes to reference printer 1 (Bambu Lab A1)
    op.execute("UPDATE order_quotes SET printer_id = 1 WHERE printer_id IS NULL")


def downgrade():
    with op.batch_alter_table('order_quotes', schema=None) as batch_op:
        batch_op.drop_constraint('fk_order_quotes_printer_id', type_='foreignkey')
        batch_op.drop_index('ix_order_quotes_printer_id')
        batch_op.drop_column('printer_id')

    op.drop_table('workshop_settings')
    op.drop_index('ix_printers_is_active', table_name='printers')
    op.drop_table('printers')
