import pytest

from app.cashbox.models import CashExpenseCategory, CashIncomeCategory, CashMovementType
from app.cashbox.services import (
    CashboxValidationError,
    create_expense_category,
    create_income_category,
    create_movement,
    list_expense_categories,
    list_income_categories,
    update_expense_category,
    update_income_category,
)


class TestCategoryServices:
    def test_list_seeded_income_and_expense_categories(self, app):
        with app.app_context():
            incomes = list_income_categories(active_only=True)
            expenses = list_expense_categories(active_only=True)

            income_codes = [c.code for c in incomes]
            expense_codes = [c.code for c in expenses]

            assert "seña" in income_codes
            assert "saldo_pedido" in income_codes
            assert "extraordinario" in income_codes
            assert "otro" in income_codes

            assert "filamento" in expense_codes
            assert "repuestos" in expense_codes
            assert "servicios" in expense_codes
            assert "embalaje" in expense_codes
            assert "mantenimiento" in expense_codes
            assert "otro" in expense_codes

    def test_create_income_category_happy_path(self, app):
        with app.app_context():
            cat = create_income_category(
                code="cursos_3d",
                name="Cursos y Clases de Impresión 3D",
                description="Ingresos por capacitaciones",
            )
            assert cat.id is not None
            assert cat.code == "cursos_3d"
            assert cat.name == "Cursos y Clases de Impresión 3D"
            assert cat.is_system is False
            assert cat.is_active is True

    def test_create_duplicate_code_rejected(self, app):
        with app.app_context():
            with pytest.raises(CashboxValidationError) as exc:
                create_income_category(code="extraordinario", name="Duplicado")
            assert "code" in exc.value.errors

    def test_update_income_category(self, app):
        with app.app_context():
            cat = create_income_category(code="test_update", name="Nombre Original")
            updated = update_income_category(
                category_id=cat.id,
                name="Nombre Modificado",
                description="Nueva descripción",
                is_active=False,
            )
            assert updated.name == "Nombre Modificado"
            assert updated.description == "Nueva descripción"
            assert updated.is_active is False

    def test_cannot_deactivate_system_category(self, app):
        with app.app_context():
            sena = CashIncomeCategory.query.filter_by(code="seña").first()
            assert sena.is_system is True
            with pytest.raises(CashboxValidationError) as exc:
                update_income_category(category_id=sena.id, is_active=False)
            assert "is_active" in exc.value.errors

    def test_create_expense_category_happy_path(self, app):
        with app.app_context():
            cat = create_expense_category(
                code="publicidad",
                name="Publicidad y Marketing",
                description="Campañas de Instagram",
            )
            assert cat.id is not None
            assert cat.code == "publicidad"
            assert cat.is_active is True

    def test_create_movement_links_category_id_and_name(self, app):
        with app.app_context():
            # Ingreso
            mov_ingreso = create_movement(
                type=CashMovementType.INGRESO.value,
                amount="3500.00",
                category="extraordinario",
                user_id=1,
            )
            assert mov_ingreso.income_category_id is not None
            assert mov_ingreso.expense_category_id is None
            assert mov_ingreso.income_category.code == "extraordinario"

            d = mov_ingreso.to_dict()
            assert d["category"] == "extraordinario"
            assert d["category_name"] == "Ingreso Extraordinario"

            # Egreso
            mov_egreso = create_movement(
                type=CashMovementType.EGRESO.value,
                amount="12000.00",
                category="filamento",
                user_id=1,
            )
            assert mov_egreso.expense_category_id is not None
            assert mov_egreso.income_category_id is None
            assert mov_egreso.expense_category.code == "filamento"

            d_egreso = mov_egreso.to_dict()
            assert d_egreso["category"] == "filamento"
            assert d_egreso["category_name"] == "Filamento"

    def test_create_movement_inactive_category_rejected(self, app):
        with app.app_context():
            cat = create_expense_category(code="inactivo_cat", name="Categoría Inactiva")
            update_expense_category(cat.id, is_active=False)

            with pytest.raises(CashboxValidationError) as exc:
                create_movement(
                    type=CashMovementType.EGRESO.value,
                    amount="100.00",
                    category="inactivo_cat",
                    user_id=1,
                )
            assert "category" in exc.value.errors


class TestCategoryRoutes:
    def test_get_income_categories(self, http_client, auth_headers):
        resp = http_client.get(
            "/api/cashbox/categories/income",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)
        assert any(c["code"] == "seña" for c in data)

    def test_post_income_category(self, http_client, auth_headers):
        resp = http_client.post(
            "/api/cashbox/categories/income",
            json={"code": "donacion", "name": "Donaciones", "description": "Aportes voluntarios"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["code"] == "donacion"
        assert data["name"] == "Donaciones"

    def test_get_expense_categories(self, http_client, auth_headers):
        resp = http_client.get(
            "/api/cashbox/categories/expense",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert any(c["code"] == "mantenimiento" for c in data)

    def test_post_expense_category(self, http_client, auth_headers):
        resp = http_client.post(
            "/api/cashbox/categories/expense",
            json={"code": "herramientas", "name": "Herramientas de Taller"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["code"] == "herramientas"

    def test_put_expense_category(self, http_client, app, auth_headers):
        with app.app_context():
            cat = CashExpenseCategory.query.filter_by(code="otro").first()
            cat_id = cat.id

        resp = http_client.put(
            f"/api/cashbox/categories/expense/{cat_id}",
            json={"name": "Otros Gastos Modificados", "is_active": True},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["name"] == "Otros Gastos Modificados"
