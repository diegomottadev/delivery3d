"""add missing check constraints (modelos ↔ base)

Seis CHECK declarados en los modelos nunca se crearon por migración: los tests los
tenían (create_all) y la base real no. Alembic no compara CHECK, por eso no se detectó.
Se verificó antes que los datos existentes los cumplen (0 filas en violación).

Revision ID: e5c1a7d93f20
Revises: 44a4db68ccde
Create Date: 2026-11-13 15:00:00.000000
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'e5c1a7d93f20'
down_revision = '44a4db68ccde'
branch_labels = None
depends_on = None


# (nombre, tabla, condición): deben coincidir 1:1 con los modelos.
CHECKS = (
    ('chk_order_items_mat_cost', 'order_items',
     'material_cost_per_kg IS NULL OR material_cost_per_kg >= 0'),
    ('chk_order_items_mat_or_fil', 'order_items',
     'material_id IS NOT NULL OR filament_id IS NOT NULL'),
    ('chk_order_quotes_labor_hour', 'order_quotes',
     'labor_cost_per_hour IS NULL OR labor_cost_per_hour >= 0'),
    ('chk_order_quotes_labor_time', 'order_quotes',
     'labor_time_minutes IS NULL OR labor_time_minutes >= 0'),
    ('chk_workshop_settings_labor_hour', 'workshop_settings',
     'labor_cost_per_hour >= 0'),
    ('chk_workshop_settings_labor_time', 'workshop_settings',
     'default_labor_time_minutes >= 0'),
)


def upgrade():
    for name, table, condition in CHECKS:
        op.create_check_constraint(name, table, condition)


def downgrade():
    for name, table, _condition in reversed(CHECKS):
        op.drop_constraint(name, table, type_='check')
