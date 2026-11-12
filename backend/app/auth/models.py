from datetime import datetime, timezone
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db


class User(db.Model):
    """User entity for authentication and system audit, conforming to OWASP guidelines."""

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(80), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False, default="unset")
    role = db.Column(db.String(20), nullable=False, default="operator")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def set_password(self, password: str) -> None:
        """Hashes password with salted pbkdf2:sha256."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        """Constant-time verification against timing attacks."""
        if not self.password_hash or self.password_hash == "unset":
            return False
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        """Safe representation (anti BOPLA / excessive data exposure: never exposes password_hash)."""
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
