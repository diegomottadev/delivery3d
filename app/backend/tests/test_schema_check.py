"""tools.schema_check: compara los CHECK de los modelos con los de una base migrada.

Alembic (`flask db check`) no compara CHECK constraints, y los tests crean el esquema
con `db.create_all()`: sin este chequeo, un CHECK puede existir en los tests y faltar
en la base real (pasó con 6 constraints hasta la migración e5c1a7d93f20).
"""

import sqlalchemy as sa

from app.extensions import db
from tools.schema_check import compare_checks, db_check_constraints, model_check_constraints


def test_compare_checks_sin_diferencias():
    checks = {"chk_a": "t1", "chk_b": "t2"}
    assert compare_checks(checks, dict(checks)) == []


def test_compare_checks_reporta_faltantes_en_la_base():
    problems = compare_checks({"chk_a": "t1", "chk_b": "t2"}, {"chk_a": "t1"})
    assert problems == ["CHECK chk_b (t2) está en los modelos pero no en la base: falta una migración"]


def test_compare_checks_reporta_sobrantes_en_la_base():
    problems = compare_checks({"chk_a": "t1"}, {"chk_a": "t1", "chk_viejo": "t3"})
    assert problems == ["CHECK chk_viejo (t3) está en la base pero no en los modelos"]


def test_compare_checks_reporta_tabla_distinta():
    problems = compare_checks({"chk_a": "t1"}, {"chk_a": "t2"})
    assert problems == ["CHECK chk_a: en los modelos está en t1 y en la base en t2"]


def test_model_check_constraints_lee_nombre_y_tabla():
    metadata = sa.MetaData()
    sa.Table(
        "piezas",
        metadata,
        sa.Column("peso", sa.Integer),
        sa.CheckConstraint("peso > 0", name="chk_piezas_peso"),
    )
    assert model_check_constraints(metadata) == {"chk_piezas_peso": "piezas"}


def test_modelos_del_proyecto_tienen_todos_sus_check_con_nombre():
    # Un CHECK sin nombre recibe uno automático distinto en cada base y no se puede comparar.
    for table in db.metadata.tables.values():
        for constraint in table.constraints:
            if isinstance(constraint, sa.CheckConstraint):
                assert isinstance(constraint.name, str) and constraint.name.startswith("chk_"), table.name


def test_base_de_test_coincide_con_los_modelos(app):
    # La base de test se crea con create_all: tiene que coincidir siempre.
    with app.app_context():
        with db.engine.connect() as connection:
            assert compare_checks(model_check_constraints(db.metadata), db_check_constraints(connection)) == []
