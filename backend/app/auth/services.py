from app.auth.models import User
from app.auth.security import generate_jwt_token
from app.extensions import db


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def authenticate_user(username: str | None, password: str | None) -> tuple[User, str]:
    """Authenticates user with constant-time verification and generic error message.
    
    Prevents:
    - User Enumeration: Identical error for unknown user or bad password.
    - Timing Attacks: `check_password` runs salted constant-time comparison.
    - Broken Authentication: Inactive users are rejected.
    """
    clean_username = str(username).strip() if username else ""
    clean_password = str(password) if password else ""

    if not clean_username or not clean_password:
        raise AuthError("Credenciales inválidas", status_code=401)

    user = User.query.filter_by(username=clean_username).first()
    if not user:
        raise AuthError("Credenciales inválidas", status_code=401)

    # Password first: the inactive status is only revealed to someone who knows the password.
    if not user.check_password(clean_password):
        raise AuthError("Credenciales inválidas", status_code=401)

    if not user.is_active:
        raise AuthError("Usuario inactivo o suspendido", status_code=401)

    token = generate_jwt_token(user)
    return user, token


def get_user_profile(user_id: int) -> User:
    """Retrieves safe user profile by ID."""
    user = db.session.get(User, user_id)
    if not user or not user.is_active:
        raise AuthError("Usuario no encontrado", status_code=404)
    return user
