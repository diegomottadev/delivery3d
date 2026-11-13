"""add labor_cost_per_hour and labor_time_minutes to workshop_settings and order_quotes

Revision ID: c83921af7b4e
Revises: b7189c4d92ef
Create Date: 2026-09-15 18:42:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c83921af7b4e'
down_revision = 'b7189c4d92ef'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Update workshop_settings
    with op.batch_alter_table('workshop_settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('labor_cost_per_hour', sa.Numeric(precision=10, scale=2), server_default='650.00', nullable=False))
        batch_op.add_column(sa.Column('default_labor_time_minutes', sa.Integer(), server_default='15', nullable=False))

    op.execute("UPDATE workshop_settings SET labor_cost_per_hour = 650.00, default_labor_time_minutes = 15")

    # 2. Update order_quotes
    with op.batch_alter_table('order_quotes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('labor_cost_per_hour', sa.Numeric(precision=10, scale=2), nullable=True))
        batch_op.add_column(sa.Column('labor_time_minutes', sa.Integer(), nullable=True))

    op.execute("UPDATE order_quotes SET labor_cost_per_hour = 650.00, labor_time_minutes = 15 WHERE labor_cost_per_hour IS NULL")


def downgrade():
    with op.batch_alter_table('order_quotes', schema=None) as batch_op:
        batch_op.drop_column('labor_time_minutes')
        batch_op.drop_column('labor_cost_per_hour')

    with op.batch_alter_table('workshop_settings', schema=None) as batch_op:
        batch_op.drop_column('default_labor_time_minutes')
        batch_op.drop_column('labor_cost_per_hour')
