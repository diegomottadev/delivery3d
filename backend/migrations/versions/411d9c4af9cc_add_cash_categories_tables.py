"""add_cash_categories_tables

Revision ID: 411d9c4af9cc
Revises: 8b56eb6b8347
Create Date: 2026-09-16 11:58:20.350526

"""
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '411d9c4af9cc'
down_revision = '8b56eb6b8347'
branch_labels = None
depends_on = None


def upgrade():
    income_table = op.create_table(
        'cash_income_categories',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_cash_income_categories_code')
    )

    expense_table = op.create_table(
        'cash_expense_categories',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_cash_expense_categories_code')
    )

    # Seed suggested income categories
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        income_table,
        [
            {'code': 'seña', 'name': 'Seña / Anticipo', 'description': 'Pago inicial para confirmar pedido', 'is_system': True, 'is_active': True, 'created_at': now},
            {'code': 'saldo_pedido', 'name': 'Saldo de Pedido', 'description': 'Cobro final contra entrega del pedido', 'is_system': True, 'is_active': True, 'created_at': now},
            {'code': 'extraordinario', 'name': 'Ingreso Extraordinario', 'description': 'Ingreso fuera de flujo habitual de pedidos', 'is_system': False, 'is_active': True, 'created_at': now},
            {'code': 'otro', 'name': 'Otro Ingreso', 'description': 'Otros ingresos generales', 'is_system': False, 'is_active': True, 'created_at': now},
        ]
    )

    # Seed suggested expense categories
    op.bulk_insert(
        expense_table,
        [
            {'code': 'filamento', 'name': 'Filamento', 'description': 'Compra de bobinas de PLA, PETG, etc.', 'is_system': False, 'is_active': True, 'created_at': now},
            {'code': 'repuestos', 'name': 'Repuestos A1', 'description': 'Nozzles, placas, extrusores y repuestos de máquina', 'is_system': False, 'is_active': True, 'created_at': now},
            {'code': 'servicios', 'name': 'Servicios', 'description': 'Electricidad, internet u otros servicios del taller', 'is_system': False, 'is_active': True, 'created_at': now},
            {'code': 'embalaje', 'name': 'Embalaje', 'description': 'Cajas, bolsas, etiquetas y materiales de empaque', 'is_system': False, 'is_active': True, 'created_at': now},
            {'code': 'mantenimiento', 'name': 'Mantenimiento', 'description': 'Lubricantes, herramientas y limpieza', 'is_system': False, 'is_active': True, 'created_at': now},
            {'code': 'otro', 'name': 'Otro Egreso', 'description': 'Otros gastos varios', 'is_system': False, 'is_active': True, 'created_at': now},
        ]
    )

    with op.batch_alter_table('cash_movements', schema=None) as batch_op:
        batch_op.add_column(sa.Column('income_category_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('expense_category_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_cash_movements_expense_category_id', ['expense_category_id'], unique=False)
        batch_op.create_index('ix_cash_movements_income_category_id', ['income_category_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_cash_movements_expense_cat',
            'cash_expense_categories',
            ['expense_category_id'],
            ['id'],
            ondelete='RESTRICT',
            onupdate='CASCADE'
        )
        batch_op.create_foreign_key(
            'fk_cash_movements_income_cat',
            'cash_income_categories',
            ['income_category_id'],
            ['id'],
            ondelete='RESTRICT',
            onupdate='CASCADE'
        )

    # Backfill existing movements if any
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE cash_movements cm
        JOIN cash_income_categories cic ON cm.category = cic.code
        SET cm.income_category_id = cic.id
        WHERE cm.type = 'ingreso'
    """))
    connection.execute(sa.text("""
        UPDATE cash_movements cm
        JOIN cash_expense_categories cec ON cm.category = cec.code
        SET cm.expense_category_id = cec.id
        WHERE cm.type = 'egreso'
    """))


def downgrade():
    with op.batch_alter_table('cash_movements', schema=None) as batch_op:
        batch_op.drop_constraint('fk_cash_movements_income_cat', type_='foreignkey')
        batch_op.drop_constraint('fk_cash_movements_expense_cat', type_='foreignkey')
        batch_op.drop_index('ix_cash_movements_income_category_id')
        batch_op.drop_index('ix_cash_movements_expense_category_id')
        batch_op.drop_column('expense_category_id')
        batch_op.drop_column('income_category_id')

    op.drop_table('cash_income_categories')
    op.drop_table('cash_expense_categories')
