"""Sincroniza el catálogo de permisos (app.rbac.constants.Perm) y crea el grupo
"Operadores" con el rol "Operador" si no existen. Idempotente.

- Permisos: inserta los nuevos y actualiza descripciones. NUNCA borra: los huérfanos
  (en la base pero no en `Perm`) solo se listan.
- Rol/grupo existentes no se modifican (la UI manda); se informa la diferencia.
- Membresía inicial: solo al crear el grupo (users.role = 'operator', no superusuarios).

Usage:
    .venv/bin/python -m seeds.seed_rbac --dry-run   # muestra el reporte y hace rollback
    .venv/bin/python -m seeds.seed_rbac             # aplica
    .venv/bin/python -m seeds.seed_rbac --strict    # exit 1 si hay permisos huérfanos

Orden en un entorno nuevo: flask db upgrade -> seeds.seed_operator -> seeds.seed_rbac
"""

import argparse
import sys

from app import create_app
from app.rbac.services import SeedReport, seed_rbac


def _print_report(report: SeedReport) -> None:
    mode = "DRY-RUN (rollback, no se persistió nada)" if report.dry_run else "APLICADO (commit)"
    catalog, operator = report.catalog, report.operator
    print(f"== seed_rbac — {mode}")
    print(
        f"Permisos: creados={len(catalog.created)} actualizados={len(catalog.updated)} "
        f"sin_cambios={catalog.unchanged}"
    )
    for code in catalog.created:
        print(f"  + {code}")
    for code in catalog.updated:
        print(f"  ~ {code} (descripción)")
    if catalog.orphans:
        print(f"HUÉRFANOS ({len(catalog.orphans)}) — no se borran, requieren migración consciente:")
        for orphan in catalog.orphans:
            roles = ", ".join(orphan.roles) if orphan.roles else "ningún rol"
            print(f"  ! {orphan.code} — usado por: {roles}")
    else:
        print("Huérfanos: ninguno")

    print(f"Rol 'Operador': {'creado' if operator.role_created else 'ya existía (no se modifica)'}")
    if operator.missing_perms:
        print(f"  faltan respecto de OPERATOR_ROLE_PERMS: {', '.join(operator.missing_perms)}")
    if operator.extra_perms:
        print(f"  sobran respecto de OPERATOR_ROLE_PERMS: {', '.join(operator.extra_perms)}")
    print(f"Grupo 'Operadores': {'creado' if operator.group_created else 'ya existía (no se modifica)'}")
    if operator.group_created:
        members = ", ".join(operator.members_added) if operator.members_added else "ninguno"
        print(f"  miembros iniciales (users.role='operator', no superusuarios): {members}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="reporta y hace rollback")
    parser.add_argument("--strict", action="store_true", help="exit 1 si hay permisos huérfanos")
    args = parser.parse_args(argv)

    app = create_app()
    with app.app_context():
        report = seed_rbac(dry_run=args.dry_run)
    _print_report(report)

    if args.strict and report.catalog.orphans:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
