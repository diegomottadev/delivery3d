#!/usr/bin/env python3
"""SessionStart: inyecta el resumen corto de la bitácora en el contexto de Claude.

Lo que este script imprime por stdout se agrega al contexto de la sesión.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bitacora_common import (
    carpeta_bitacora,
    dir_actual,
    leer_input,
    raiz_principal,
)

MAX_CHARS = 2500  # ~600 tokens: más que esto empeora el razonamiento

data = leer_input()
bitacora = carpeta_bitacora(data)
resumen = bitacora / "resumen" / "resumen.md"

if not resumen.exists():
    sys.exit(0)

texto = resumen.read_text(encoding="utf-8").strip()
if len(texto) > MAX_CHARS:
    texto = texto[:MAX_CHARS].rsplit("\n", 1)[0] + (
        "\n[...resumen recortado: compactarlo con el skill bitacora-proyecto]"
    )

print("## Contexto del proyecto (bitácora)\n")
print(texto)

en_worktree = dir_actual(data).resolve() != raiz_principal(dir_actual(data)).resolve()
print(
    f"\nBitácora: {bitacora}"
    + (" (checkout principal; esta sesión corre en un worktree, no escribas la bitácora acá)." if en_worktree else ".")
    + " Detalle en resumen/decisiones.md, regresiones.md y descartado.md."
    " Antes de tocar algo que figure en regresiones o descartado, leelo y avisá al usuario."
)
