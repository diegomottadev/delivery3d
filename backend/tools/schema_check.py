"""Compara los CHECK constraints de los modelos con los de una base migrada.

`flask db check` (Alembic) compara tablas, columnas, índices y FKs, pero NO los CHECK.
Como los tests crean el esquema con `db.create_all()`, un CHECK declarado solo en el
modelo pasa los tests y falta en la base real. Este chequeo cierra ese hueco.

Uso (contra la base de DB_NAME, después de `flask db upgrade`):
    PYTHONPATH=. .venv/bin/python -m tools.schema_check
Sale con código 1 si hay diferencias. No modifica nada.
"""

import sys

import sqlalchemy as sa


def model_check_constraints(metadata: sa.MetaData) -> dict[str, str]:
    """{nombre: tabla} de los CHECK con nombre declarados en los modelos."""
    return {
        constraint.name: table.name
        for table in metadata.tables.values()
        for constraint in table.constraints
        if isinstance(constraint, sa.CheckConstraint) and isinstance(constraint.name, str)
    }


def db_check_constraints(connection: sa.Connection) -> dict[str, str]:
    """{nombre: tabla} de los CHECK de la base actual (information_schema de MySQL 8)."""
    rows = connection.execute(
        sa.text(
            "SELECT tc.constraint_name, tc.table_name "
            "FROM information_schema.table_constraints tc "
            "WHERE tc.constraint_schema = DATABASE() AND tc.constraint_type = 'CHECK'"
        )
    )
    return {name: table for name, table in rows}


def compare_checks(model: dict[str, str], database: dict[str, str]) -> list[str]:
    problems = []
    for name in sorted(model.keys() - database.keys()):
        problems.append(f"CHECK {name} ({model[name]}) está en los modelos pero no en la base: falta una migración")
    for name in sorted(database.keys() - model.keys()):
        problems.append(f"CHECK {name} ({database[name]}) está en la base pero no en los modelos")
    for name in sorted(model.keys() & database.keys()):
        if model[name] != database[name]:
            problems.append(f"CHECK {name}: en los modelos está en {model[name]} y en la base en {database[name]}")
    return problems


def main() -> int:
    from app import create_app
    from app.extensions import db

    app = create_app()
    with app.app_context(), db.engine.connect() as connection:
        problems = compare_checks(model_check_constraints(db.metadata), db_check_constraints(connection))
    for problem in problems:
        print(problem)
    if not problems:
        print("CHECK constraints: modelos y base coinciden.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
