#!/usr/bin/env python3
"""UserPromptSubmit: guarda cada prompt textual en .claude/bitacora/prompts/AAAA-MM-DD.md.

Determinístico (no depende de que Claude se acuerde) y no gasta tokens.
La carpeta prompts/ está en .gitignore porque el repo es público.
No imprime nada: en UserPromptSubmit el stdout se agregaría al contexto.
"""
import re
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bitacora_common import carpeta_bitacora, dir_actual, leer_input

# (patrón, reemplazo). Los que tienen grupo conservan el nombre de la variable.
SECRETOS = [
    (r"sk-[A-Za-z0-9_\-]{16,}", "[REDACTADO]"),                    # Anthropic / OpenAI
    (r"gh[pousr]_[A-Za-z0-9]{20,}", "[REDACTADO]"),                # GitHub
    (r"AKIA[0-9A-Z]{16}", "[REDACTADO]"),                          # AWS
    (r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]+", "[JWT REDACTADO]"),
    (r"(?i)bearer\s+[A-Za-z0-9._\-]{16,}", "Bearer [REDACTADO]"),
    (r"(?i)(mysql(?:\+pymysql)?://[^:\s]+:)[^@\s]+@", r"\1[REDACTADO]@"),  # URL con contraseña
    # Variables del backend/.env y genéricas: JWT_SECRET_KEY=..., DB_PASSWORD: ..., etc.
    (r"(?i)(\b[\w]*(?:password|passwd|secret|token|api[_-]?key|contraseña)[\w]*\s*[:=]\s*)\S+",
     r"\1[REDACTADO]"),
]


def redactar(texto: str) -> str:
    for patron, reemplazo in SECRETOS:
        texto = re.sub(patron, reemplazo, texto)
    return texto


data = leer_input()
prompt = (data.get("prompt") or "").strip()
if not prompt:
    sys.exit(0)

carpeta = carpeta_bitacora(data) / "prompts"
carpeta.mkdir(parents=True, exist_ok=True)

ahora = datetime.now()  # noqa: DTZ005 (hora local a propósito)
archivo = carpeta / f"{ahora:%Y-%m-%d}.md"
nuevo = not archivo.exists()

origen = dir_actual(data).name
sesion = (data.get("session_id") or "")[:8]

with archivo.open("a", encoding="utf-8") as f:
    if nuevo:
        f.write(f"# Prompts {ahora:%Y-%m-%d}\n")
    f.write(f"\n## {ahora:%H:%M} · sesión {sesion} · {origen}\n\n")
    f.write("\n".join("> " + linea for linea in redactar(prompt).splitlines()) + "\n")

sys.exit(0)
