"""Seeds the default administrator operator (id=1) with a secure hashed password.

Credenciales tomadas del entorno / backend/.env:
- SEED_OPERATOR_USERNAME (default: operador)
- SEED_OPERATOR_PASSWORD (obligatoria)

Usage: .venv/bin/python -m seeds.seed_operator
"""

import os

from app import create_app
from app.auth.models import User
from app.config import require_env
from app.extensions import db

SEED_ID = 1


def run() -> None:
    SEED_USERNAME = os.environ.get("SEED_OPERATOR_USERNAME", "operador")
    SEED_PASSWORD = require_env("SEED_OPERATOR_PASSWORD")
    app = create_app()
    with app.app_context():
        operator = db.session.get(User, SEED_ID)
        if operator is None:
            operator = User(
                id=SEED_ID,
                username=SEED_USERNAME,
                role="admin",
                is_active=True,
            )
            operator.set_password(SEED_PASSWORD)
            db.session.add(operator)
            db.session.commit()
            print(f"Created seed operator: id={operator.id}, username={operator.username}")
        else:
            operator.role = "admin"
            operator.is_active = True
            operator.set_password(SEED_PASSWORD)
            db.session.commit()
            print(f"Updated seed operator: id={operator.id}, username={operator.username}")


if __name__ == "__main__":
    run()
