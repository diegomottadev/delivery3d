"""Utilidades compartidas por los hooks de la bitácora de Delivery3D."""
import json
import os
import subprocess
import sys
from pathlib import Path


def leer_input() -> dict:
    try:
        return json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return {}


def dir_actual(data: dict) -> Path:
    """Carpeta donde corre la sesión: el checkout principal o un worktree."""
    return Path(os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd())


def raiz_principal(desde: Path) -> Path:
    """Checkout principal del repo, aunque la sesión corra en .worktrees/<rama>.

    La bitácora vive siempre ahí para no tener una copia por worktree.
    """
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
            cwd=desde, capture_output=True, text=True, timeout=5, check=True,
        ).stdout.strip()
        git_dir = Path(out)
        if git_dir.name == ".git":
            return git_dir.parent
    except (subprocess.SubprocessError, OSError):
        return desde  # sin git: usar la carpeta actual
    return desde


def carpeta_bitacora(data: dict) -> Path:
    return raiz_principal(dir_actual(data)) / ".claude" / "bitacora"
