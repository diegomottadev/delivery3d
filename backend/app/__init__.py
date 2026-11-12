import logging

from flask import Flask, jsonify
from werkzeug.exceptions import InternalServerError

from app.auth.rate_limit import LoginRateLimiter
from app.config import build_database_url, require_env
from app.extensions import db, migrate
from app.http import InvalidJsonBody

AUDIT_LOGGER = "delivery3d.audit"


def _configure_audit_logger() -> None:
    logger = logging.getLogger(AUDIT_LOGGER)
    if logger.level == logging.NOTSET:
        logger.setLevel(logging.INFO)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s AUDIT %(message)s"))
        logger.addHandler(handler)


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(InvalidJsonBody)
    def invalid_json_body(_exc):
        return jsonify(error="El cuerpo de la solicitud debe ser un objeto JSON"), 422

    @app.errorhandler(InternalServerError)
    def internal_error(exc):
        # Stack trace solo al log del servidor; al cliente, mensaje genérico (OWASP A10).
        original = getattr(exc, "original_exception", None) or exc
        app.logger.error("unhandled_exception", exc_info=original)
        return jsonify(error="Error interno del servidor"), 500


def create_app(config_overrides: dict | None = None) -> Flask:
    app = Flask(__name__)
    overrides = config_overrides or {}

    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # 1 MB: la API solo recibe JSON chico
    app.extensions["login_rate_limiter"] = LoginRateLimiter()
    _configure_audit_logger()
    _register_error_handlers(app)
    if "SQLALCHEMY_DATABASE_URI" not in overrides:
        app.config["SQLALCHEMY_DATABASE_URI"] = build_database_url()
    if "JWT_SECRET_KEY" not in overrides:
        app.config["JWT_SECRET_KEY"] = require_env("JWT_SECRET_KEY")

    app.config.update(overrides)

    db.init_app(app)
    migrate.init_app(app, db)

    # Import order matters: models with FKs must be imported after their targets so
    # SQLAlchemy can resolve `db.ForeignKey("<table>.id")` string references.
    from app.auth import models as auth_models  # noqa: F401
    from app.rbac import models as rbac_models  # noqa: F401
    from app.clients import models as clients_models  # noqa: F401
    from app.filaments import models as filaments_models  # noqa: F401
    from app.materials import models as materials_models  # noqa: F401
    from app.printers import models as printers_models  # noqa: F401
    from app.settings import models as settings_models  # noqa: F401
    from app.orders import models as orders_models  # noqa: F401
    from app.cashbox import models as cashbox_models  # noqa: F401
    from app.orders.routes import orders_bp
    from app.materials.routes import materials_bp
    from app.filaments.routes import filaments_bp
    from app.printers.routes import printers_bp
    from app.settings.routes import settings_bp
    from app.cashbox.routes import cashbox_bp
    from app.auth.routes import auth_bp

    app.register_blueprint(orders_bp)
    app.register_blueprint(materials_bp)
    app.register_blueprint(filaments_bp)
    app.register_blueprint(printers_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(cashbox_bp)
    app.register_blueprint(auth_bp)

    @app.after_request
    def apply_security_headers(response):
        """Applies essential HTTP security headers recommended by OWASP & Neil Madden."""
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    @app.get("/")
    def index():
        return {
            "status": "online",
            "service": "Delivery3D API",
            "endpoints": [
                "/api/auth",
                "/api/orders",
                "/api/materials",
                "/api/filaments",
                "/api/printers",
                "/api/settings",
                "/api/cashbox",
            ],
            "frontend_url": "http://localhost:3000",
        }, 200

    return app
