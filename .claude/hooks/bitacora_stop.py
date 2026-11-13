#!/usr/bin/env python3
"""Stop: si hubo cambios de código todavía sin registrar, le pide a Claude que use la bitácora.

Mira los archivos modificados (git status) del checkout o worktree donde corre la
sesión y los compara con la última actualización de la bitácora. En turnos sin
cambios no hace nada.
"""
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bitacora_common import carpeta_bitacora, dir_actual, leer_input

# Cambios que no cuentan como "trabajo para registrar"
IGNORAR = (".claude/", ".worktrees/", "frontend/build/")

data = leer_input()

# Evita loops: si Claude ya está continuando por este hook, dejarlo terminar.
if data.get("stop_hook_active"):
    sys.exit(0)

aqui = dir_actual(data)
try:
    salida = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=all"],
        cwd=aqui, capture_output=True, text=True, timeout=10, check=True,
    ).stdout
except (subprocess.SubprocessError, OSError):
    sys.exit(0)  # sin git o git falló: no molestar

cambiados = []
for linea in salida.splitlines():
    ruta = linea[3:].split(" -> ")[-1].strip().strip('"')
    if not ruta or ruta.startswith(IGNORAR):
        continue
    p = aqui / ruta
    if p.is_file():
        cambiados.append(p)

if not cambiados:
    sys.exit(0)

# Última actualización de la bitácora (sin prompts/, que escribe otro hook)
bitacora = carpeta_bitacora(data)
ultimo_registro = 0.0
if bitacora.exists():
    for p in bitacora.rglob("*.md"):
        if "prompts" not in p.parts:
            ultimo_registro = max(ultimo_registro, p.stat().st_mtime)

ahora = datetime.now()  # noqa: DTZ005 (hora local a propósito)
hoy = ahora.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
pendientes = [p for p in cambiados if p.stat().st_mtime > max(ultimo_registro, hoy)]

if not pendientes:
    sys.exit(0)

lista = ", ".join(str(p.relative_to(aqui)) for p in pendientes[:8])
if len(pendientes) > 8:
    lista += f" y {len(pendientes) - 8} más"

print(json.dumps({
    "decision": "block",
    "reason": (
        f"Hay cambios sin registrar en la bitácora ({lista}). "
        "Si este turno cerró una tarea o una parte con sentido propio, usá el skill "
        f"bitacora-proyecto y escribí en {bitacora}. Si el trabajo sigue a medias, "
        "no registres y terminá el turno normalmente."
    ),
}, ensure_ascii=False))
sys.exit(0)
