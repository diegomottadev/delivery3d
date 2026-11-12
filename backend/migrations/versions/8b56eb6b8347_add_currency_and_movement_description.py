"""add_currency_and_movement_description

Revision ID: 8b56eb6b8347
Revises: d9401ab23e7f
Create Date: 2026-09-16 11:18:03.709722

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8b56eb6b8347'
down_revision = 'd9401ab23e7f'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('cash_movements', schema=None) as batch_op:
        batch_op.add_column(sa.Column('description', sa.String(length=255), nullable=True))

    with op.batch_alter_table('workshop_settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('currency_code', sa.String(length=3), nullable=False, server_default='ARS'))
        batch_op.add_column(sa.Column('currency_symbol', sa.String(length=10), nullable=False, server_default='AR$'))


def downgrade():
    with op.batch_alter_table('workshop_settings', schema=None) as batch_op:
        batch_op.drop_column('currency_symbol')
        batch_op.drop_column('currency_code')

    with op.batch_alter_table('cash_movements', schema=None) as batch_op:
        batch_op.drop_column('description')
