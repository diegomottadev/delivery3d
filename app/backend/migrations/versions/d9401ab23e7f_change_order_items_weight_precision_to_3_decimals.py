"""change order_items weight_g precision to 3 decimals

Revision ID: d9401ab23e7f
Revises: c83921af7b4e
Create Date: 2026-09-16 10:25:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd9401ab23e7f'
down_revision = 'c83921af7b4e'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.alter_column(
            'weight_g',
            existing_type=sa.Numeric(precision=8, scale=2),
            type_=sa.Numeric(precision=10, scale=3),
            existing_nullable=False,
        )


def downgrade():
    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.alter_column(
            'weight_g',
            existing_type=sa.Numeric(precision=10, scale=3),
            type_=sa.Numeric(precision=8, scale=2),
            existing_nullable=False,
        )
