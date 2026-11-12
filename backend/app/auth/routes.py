from flask import Blueprint, current_app, g, jsonify, request

from app.auth.security import TOKEN_EXPIRATION_HOURS, login_required
from app.auth.services import AuthError, authenticate_user
from app.http import json_body

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/login")
def login_route():
    """Authenticates credentials and issues a cryptographically signed JWT."""
    # Strict parameter whitelisting (Mitigates OWASP BOPLA / Mass Assignment)
    data = json_body()
    username = data.get("username")
    password = data.get("password")

    limiter = current_app.extensions["login_rate_limiter"]
    key = limiter.key(request.remote_addr, username)
    retry_after = limiter.retry_after(key)
    if retry_after:
        current_app.logger.warning("login_blocked ip=%s", request.remote_addr)
        resp = jsonify(error="Demasiados intentos fallidos. Probá de nuevo más tarde.")
        resp.headers["Retry-After"] = str(retry_after)
        return resp, 429

    try:
        user, token = authenticate_user(username=username, password=password)
    except AuthError as exc:
        limiter.register_failure(key)
        current_app.logger.info("login_failed ip=%s", request.remote_addr)
        return jsonify(error=exc.message), exc.status_code

    limiter.register_success(key)
    return (
        jsonify(
            {
                "token": token,
                "user": user.to_dict(),
                "expires_in": TOKEN_EXPIRATION_HOURS * 3600,
            }
        ),
        200,
    )


@auth_bp.get("/me")
@login_required
def me_route():
    """Returns safe profile of the currently authenticated operator (Mitigates BOLA)."""
    return jsonify(g.current_user.to_dict()), 200
