from decimal import Decimal
import pytest

from app.cashbox.models import CashMovement, CashMovementType
from app.cashbox.services import (
    CashboxValidationError,
    OrderBalanceError,
    collect_order_balance,
    create_movement,
    get_cash_summary,
    get_order_balance_info,
    list_movements,
)
from app.clients.models import Client
from app.extensions import db
from app.orders.models import Order, OrderQuote, OrderStatus


def _create_test_order(informed_price: str = "15000.00") -> Order:
    client = Client(name="Juan Perez", origin="whatsapp")
    db.session.add(client)
    db.session.flush()

    order = Order(client_id=client.id, user_id=1, status=OrderStatus.PRESUPUESTADO.value)
    db.session.add(order)
    db.session.flush()

    quote = OrderQuote(
        order_id=order.id,
        waste_purge_pct=Decimal("10.00"),
        machine_power_watts=Decimal("150.00"),
        kwh_cost=Decimal("278.00"),
        machine_cost_per_hour=Decimal("120.00"),
        labor_cost=Decimal("1500.00"),
        profit_margin_pct=Decimal("50.00"),
        informed_price=Decimal(informed_price),
    )
    db.session.add(quote)
    db.session.commit()
    return order


def test_create_movement_ingreso_happy_path(app):
    with app.app_context():
        mov = create_movement(
            type=CashMovementType.INGRESO.value,
            amount="5000.50",
            category="extraordinario",
            description="Venta de accesorio en stock",
            user_id=1,
        )
        assert mov.id is not None
        assert mov.type == "ingreso"
        assert mov.amount == Decimal("5000.50")
        assert mov.category == "extraordinario"
        assert mov.description == "Venta de accesorio en stock"
        assert mov.order_id is None


def test_create_movement_egreso_happy_path(app):
    with app.app_context():
        mov = create_movement(
            type=CashMovementType.EGRESO.value,
            amount=18500.00,
            category="filamento",
            description="Bobina PLA 1kg Grilon3D Negro",
            user_id=1,
        )
        assert mov.id is not None
        assert mov.type == "egreso"
        assert mov.amount == Decimal("18500.00")
        assert mov.category == "filamento"


def test_create_movement_invalid_type_rejected(app):
    with app.app_context():
        with pytest.raises(CashboxValidationError) as exc:
            create_movement(type="prestamo", amount=1000, category="otro")
        assert "type" in exc.value.errors


def test_create_movement_zero_or_negative_amount_rejected(app):
    with app.app_context():
        with pytest.raises(CashboxValidationError) as exc:
            create_movement(type="ingreso", amount=0, category="otro")
        assert "amount" in exc.value.errors

        with pytest.raises(CashboxValidationError) as exc:
            create_movement(type="egreso", amount=-500, category="filamento")
        assert "amount" in exc.value.errors


def test_create_movement_non_numeric_amount_rejected(app):
    with app.app_context():
        with pytest.raises(CashboxValidationError) as exc:
            create_movement(type="ingreso", amount="cien_pesos", category="otro")
        assert "amount" in exc.value.errors


def test_create_movement_empty_category_rejected(app):
    with app.app_context():
        with pytest.raises(CashboxValidationError) as exc:
            create_movement(type="ingreso", amount=1000, category="")
        assert "category" in exc.value.errors


def test_create_movement_nonexistent_order_id_rejected(app):
    with app.app_context():
        with pytest.raises(CashboxValidationError) as exc:
            create_movement(type="ingreso", amount=1000, category="seña", order_id=99999)
        assert "order_id" in exc.value.errors


def test_get_cash_summary_dynamic_calculation(app):
    with app.app_context():
        # Caja vacía
        summary = get_cash_summary()
        assert summary["total_ingresos"] == 0.0
        assert summary["total_egresos"] == 0.0
        assert summary["current_balance"] == 0.0
        assert summary["movements_count"] == 0
        assert summary["currency_code"] == "ARS"
        assert summary["currency_symbol"] == "AR$"

        # Agregar movimientos
        create_movement(type="ingreso", amount="10000.00", category="seña")
        create_movement(type="ingreso", amount="5000.00", category="extraordinario")
        create_movement(type="egreso", amount="3500.00", category="repuestos")
        create_movement(type="egreso", amount="4000.00", category="filamento")

        summary = get_cash_summary()
        assert summary["total_ingresos"] == 15000.00
        assert summary["total_egresos"] == 7500.00
        assert summary["current_balance"] == 7500.00
        assert summary["movements_count"] == 4


def test_list_movements_filters_and_order(app):
    with app.app_context():
        create_movement(type="ingreso", amount=1000, category="seña")
        create_movement(type="egreso", amount=2000, category="filamento")
        create_movement(type="egreso", amount=3000, category="repuestos")

        all_movs = list_movements()
        assert len(all_movs) == 3
        # Newest first
        assert all_movs[0].amount == Decimal("3000.00")
        assert all_movs[2].amount == Decimal("1000.00")

        egresos = list_movements(type_="egreso")
        assert len(egresos) == 2
        assert all(m.type == "egreso" for m in egresos)

        repuestos = list_movements(category="repuestos")
        assert len(repuestos) == 1
        assert repuestos[0].category == "repuestos"


def test_order_balance_and_collection(app):
    with app.app_context():
        order = _create_test_order("20000.00")

        # Sin pagos previos
        info = get_order_balance_info(order.id)
        assert info["informed_price"] == 20000.00
        assert info["total_paid"] == 0.00
        assert info["pending_balance"] == 20000.00

        # Registrar seña de 6000
        create_movement(type="ingreso", amount="6000.00", category="seña", order_id=order.id)
        info = get_order_balance_info(order.id)
        assert info["total_paid"] == 6000.00
        assert info["pending_balance"] == 14000.00

        # Cobrar saldo parcial
        mov1 = collect_order_balance(order.id, user_id=1, amount="4000.00")
        assert mov1.amount == Decimal("4000.00")
        assert mov1.category == "saldo_pedido"
        assert mov1.order_id == order.id

        info = get_order_balance_info(order.id)
        assert info["total_paid"] == 10000.00
        assert info["pending_balance"] == 10000.00

        # Cobrar saldo restante sin especificar monto (liquida todo)
        mov2 = collect_order_balance(order.id, user_id=1)
        assert mov2.amount == Decimal("10000.00")

        info = get_order_balance_info(order.id)
        assert info["total_paid"] == 20000.00
        assert info["pending_balance"] == 0.00

        # Intentar cobrar cuando ya está cancelado el saldo
        with pytest.raises(OrderBalanceError):
            collect_order_balance(order.id, user_id=1)


def test_ex04_balance_floored_at_zero_when_incomes_exceed_price(app):
    with app.app_context():
        order = _create_test_order("8000.00")
        create_movement(type="ingreso", amount="3000.00", category="seña", order_id=order.id)
        create_movement(type="ingreso", amount="6000.00", category="extraordinario", order_id=order.id)

        info = get_order_balance_info(order.id)

        assert info["informed_price"] == 8000.00
        assert info["total_paid"] == 9000.00
        assert info["pending_balance"] == 0.00


def test_ex05_order_without_informed_price_has_zero_price_and_zero_balance(app):
    with app.app_context():
        client = Client(name="Sin Cotizar", origin="whatsapp")
        db.session.add(client)
        db.session.flush()
        order = Order(client_id=client.id, user_id=1, status=OrderStatus.NUEVO.value)
        db.session.add(order)
        db.session.commit()

        info = get_order_balance_info(order.id)

        assert info["informed_price"] == 0.00
        assert info["total_paid"] == 0.00
        assert info["pending_balance"] == 0.00


def test_ex06_expense_linked_to_order_does_not_reduce_pending_balance(app):
    with app.app_context():
        order = _create_test_order("15000.00")
        create_movement(type="egreso", amount="2000.00", category="filamento", order_id=order.id)

        info = get_order_balance_info(order.id)

        assert info["total_paid"] == 0.00
        assert info["pending_balance"] == 15000.00


def test_add_movement_does_not_commit_so_rollback_discards_it(app):
    # Imported here so a missing symbol fails only this test, not the module collection.
    from app.cashbox.services import add_movement

    with app.app_context():
        add_movement(
            type=CashMovementType.INGRESO.value,
            amount="1000.00",
            category="extraordinario",
            description="Movimiento sin commit",
            user_id=1,
        )
        db.session.rollback()

        assert CashMovement.query.count() == 0
