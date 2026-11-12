import pytest

from app import create_app
from app.auth.models import User
from app.extensions import db
from app.filaments.models import Filament
from app.materials.models import Material, MaterialType

from app.cashbox.models import CashExpenseCategory, CashIncomeCategory

from app.config import build_database_url, require_env


@pytest.fixture(scope="session")
def app():
    application = create_app(
        {
            "SQLALCHEMY_DATABASE_URI": build_database_url(require_env("DB_TEST_NAME")),
            "JWT_SECRET_KEY": "test-secret",
            "TESTING": True,
        }
    )
    with application.app_context():
        db.create_all()
        db.session.remove()

    yield application

    with application.app_context():
        db.drop_all()
        db.session.remove()


@pytest.fixture(autouse=True)
def _clean_tables(app):
    with app.app_context():
        # FK-safe truncation order: children before parents.
        db.session.execute(db.text("SET FOREIGN_KEY_CHECKS=0"))
        for table in (
            "cash_movements",
            "cash_income_categories",
            "cash_expense_categories",
            "order_status_history",
            "order_quotes",
            "order_items",
            "orders",
            "clients",
            "materials",
            "filaments",
            "workshop_settings",
            "printers",
            "users",
        ):
            db.session.execute(db.text(f"TRUNCATE TABLE {table}"))
        db.session.execute(db.text("SET FOREIGN_KEY_CHECKS=1"))
        user = User(id=1, username="operador", role="admin", is_active=True)
        user.set_password("operador123")
        db.session.add(user)
        db.session.add_all([
            Filament(id=1, name="PLA"),
            Filament(id=2, name="PETG"),
        ])
        db.session.add_all([
            CashIncomeCategory(code="seña", name="Seña / Anticipo", is_system=True, is_active=True),
            CashIncomeCategory(code="saldo_pedido", name="Saldo de Pedido", is_system=True, is_active=True),
            CashIncomeCategory(code="extraordinario", name="Ingreso Extraordinario", is_system=False, is_active=True),
            CashIncomeCategory(code="otro", name="Otro Ingreso", is_system=False, is_active=True),
            CashExpenseCategory(code="filamento", name="Filamento", is_system=False, is_active=True),
            CashExpenseCategory(code="repuestos", name="Repuestos A1", is_system=False, is_active=True),
            CashExpenseCategory(code="servicios", name="Servicios", is_system=False, is_active=True),
            CashExpenseCategory(code="embalaje", name="Embalaje", is_system=False, is_active=True),
            CashExpenseCategory(code="mantenimiento", name="Mantenimiento", is_system=False, is_active=True),
            CashExpenseCategory(code="otro", name="Otro Egreso", is_system=False, is_active=True),
        ])
        db.session.commit()
        db.session.remove()
    yield


@pytest.fixture
def http_client(app):
    return app.test_client()


@pytest.fixture
def material(app):
    with app.app_context():
        m = Material(brand="eSun", type=MaterialType.PLA.value, color="Blanco", cost_per_kg="18000.00")
        db.session.add(m)
        db.session.commit()
        material_id = m.id
        db.session.remove()
    return material_id


@pytest.fixture
def filament(app):
    return 1


def make_token(app, user_id: int) -> str:
    """JWT con los claims que exige login_required (sub, iss, iat, exp)."""
    from datetime import datetime, timedelta, timezone

    import jwt

    from app.auth.security import ISSUER

    now = datetime.now(timezone.utc)
    claims = {"sub": str(user_id), "iss": ISSUER, "iat": now, "exp": now + timedelta(hours=1)}
    with app.app_context():
        return jwt.encode(claims, app.config["JWT_SECRET_KEY"], algorithm="HS256")


@pytest.fixture(autouse=True)
def _reset_login_rate_limit(app):
    limiter = app.extensions.get("login_rate_limiter")
    if limiter is not None:
        limiter.reset()
    yield


@pytest.fixture
def auth_headers(app):
    return {"Authorization": f"Bearer {make_token(app, 1)}"}
