"""Sincronía enum `Perm` (backend) <-> `PERM` (frontend/src/features/security/permissions/perms.js).

Formato acordado (api-contract.md §7): dentro de `export const PERM = Object.freeze({ ... })`,
una entrada por línea `NOMBRE_MIEMBRO: 'recurso:acción',`. Se permiten líneas vacías y
comentarios `//`. Cualquier otra línea rompe el formato y hace fallar el test.
Si el archivo no existe, el test FALLA (monorepo: backend y frontend viajan juntos).
"""

import re
from pathlib import Path

from app.rbac.constants import Perm

PERMS_JS = Path(__file__).resolve().parents[3] / "frontend/src/features/security/permissions/perms.js"
BLOCK_RE = re.compile(r"export const PERM = Object\.freeze\(\{(?P<body>.*?)\}\);", re.DOTALL)
ENTRY_RE = re.compile(r"^(?P<name>[A-Z][A-Z0-9_]*):\s*'(?P<code>[^']+)',?$")


def _parse_perm_block() -> list[tuple[str, str]]:
    assert PERMS_JS.is_file(), f"No existe {PERMS_JS}"
    match = BLOCK_RE.search(PERMS_JS.read_text(encoding="utf-8"))
    assert match, "No se encontró `export const PERM = Object.freeze({ ... });` en perms.js"

    entries = []
    for raw in match.group("body").splitlines():
        line = raw.strip()
        if not line or line.startswith("//"):
            continue
        entry = ENTRY_RE.match(line)
        assert entry, f"Línea con formato inválido en perms.js: {line!r}"
        entries.append((entry.group("name"), entry.group("code")))
    return entries


def test_frontend_perm_has_no_duplicate_members_or_codes():
    entries = _parse_perm_block()
    names = [name for name, _ in entries]
    codes = [code for _, code in entries]
    assert len(names) == len(set(names)), "Miembros repetidos en PERM"
    assert len(codes) == len(set(codes)), "Codes repetidos en PERM"


def test_frontend_perm_mirrors_backend_enum():
    frontend = dict(_parse_perm_block())
    backend = {perm.name: perm.value for perm in Perm}

    missing = sorted(set(backend) - set(frontend))
    extra = sorted(set(frontend) - set(backend))
    mismatched = sorted(n for n in set(backend) & set(frontend) if backend[n] != frontend[n])

    assert (missing, extra, mismatched) == ([], [], []), (
        f"faltan en perms.js: {missing}; sobran en perms.js: {extra}; code distinto: {mismatched}"
    )
