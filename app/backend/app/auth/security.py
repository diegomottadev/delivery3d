from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, jsonify, request

from app.auth.models import User
from app.extensions import db

TOKEN_EXPIRATION_HOURS = 24
ALGORITHM = "HS256"
ISSUER = "delivery3d-api"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_jwt_token(user: User, expires_in_hours: int = TOKEN_EXPIRATION_HOURS) -> str:
    """Generates a signed JWT with strict claims adhering to OWASP API Security guidelines."""
    now = _utcnow()
    exp = now + timedelta(hours=expires_in_hours)
    payload = {
        "sub": str(user.id),
        "iss": ISSUER,
        "iat": now,
        "exp": exp,
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm=ALGORITHM)


def decode_jwt_token(token: str) -> dict:
    """Decodes and strictly validates JWT signature, algorithm pinning, and expiration."""
    return jwt.decode(
        token,
        current_app.config["JWT_SECRET_KEY"],
        algorithms=[ALGORITHM],
        issuer=ISSUER,
        options={"require": ["sub", "exp", "iat", "iss"]},
    )


def login_required(view):
    """Enforces authentication and resolves user context, preventing BOLA vulnerabilities.
    
    Verifies Bearer token, checks user existence and active status in database,
    and sets `g.current_user_id` and `g.current_user`.
    """

    @wraps(view)
    def wrapped(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify(error="Falta o es inválida la cabecera de autorización"), 401

        token = auth_header.removeprefix("Bearer ").strip()
        if not token:
            return jsonify(error="Token de autorización vacío"), 401

        try:
            payload = decode_jwt_token(token)
            sub_id = int(payload.get("sub"))
        except (jwt.PyJWTError, ValueError, TypeError):
            return jsonify(error="Token inválido o expirado"), 401

        user = db.session.get(User, sub_id)
        if not user or not user.is_active:
            return jsonify(error="Usuario inexistente o inactivo"), 401

        g.current_user_id = user.id
        g.current_user = user
        return view(*args, **kwargs)

    return wrapped


def roles_required(*allowed_roles: str):
    """DEPRECADO (rbac-access-control): usar `app.rbac.security.permission_required(Perm.X)`.

    Autorizaba por la columna deprecada `users.role`. No tiene usos; se conserva hasta que
    se elimine `users.role` en un cambio posterior.
    """

    def decorator(view):
        @wraps(view)
        @login_required
        def wrapped(*args, **kwargs):
            if g.current_user.role not in allowed_roles:
                return jsonify(error="Acceso denegado: permisos insuficientes"), 403
            return view(*args, **kwargs)

        return wrapped

    return decorator
