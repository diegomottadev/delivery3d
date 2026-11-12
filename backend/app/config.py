"""Configuración desde variables de entorno.

Los secretos NO tienen valores por defecto: deben venir del entorno
(docker-compose `env_file`) o de `backend/.env` (cargado con python-dotenv).
Ver `backend/.env.example`.
"""

import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

# backend/.env — no pisa variables ya definidas en el entorno (ej. docker-compose).
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Falta la variable de entorno {name}. "
            "Copiá backend/.env.example a backend/.env y completala."
        )
    return value


def build_database_url(db_name: str | None = None) -> str:
    user = quote_plus(require_env("DB_USER"))
    password = quote_plus(require_env("DB_PASSWORD"))
    host = os.environ.get("DB_HOST", "localhost")
    port = os.environ.get("DB_PORT", "3306")
    name = db_name or require_env("DB_NAME")
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}?charset=utf8mb4"
