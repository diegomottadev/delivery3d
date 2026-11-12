from decimal import Decimal

import pytest

from app.cashbox.models import CashMovement
from app.clients.models import Client
from app.extensions import db
from app.orders.models import Order, OrderQuote, OrderStatus, OrderStatusHistory


def _seed_order_for_test(app, informed_price="12000.00") -> int:
    with app.app_context():
        client = Client(name="Cliente Prueba", origin="whatsapp")
        db.session.add(client)
        db.session.flush()

        order = Order(client_id=client.id, user_id=1, status=OrderStatus.LISTO.value)
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
        order_id = order.id
        db.session.remove()
    return order_id


def test_get_summary_route(http_client, auth_headers):
    resp = http_client.get("/api/cashbox/summary", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert "total_ingresos" in data
    assert "total_egresos" in data
    assert "current_balance" in data
    assert "currency_code" in data
    assert "currency_symbol" in data


def test_create_and_list_movements_routes(http_client, auth_headers):
    # Crear un egreso
    payload_egreso = {
        "type": "egreso",
        "amount": 7500.00,
        "category": "filamento",
        "description": "Bobina PLA Grilon Rojo",
    }
    resp = http_client.post("/api/cashbox/movements", json=payload_egreso, headers=auth_headers)
    assert resp.status_code == 201
    egreso = resp.get_json()
    assert egreso["type"] == "egreso"
    assert egreso["amount"] == 7500.00
    assert egreso["category"] == "filamento"
    assert egreso["description"] == "Bobina PLA Grilon Rojo"
    assert egreso["operator_username"] == "operador"

    # Crear un ingreso
    payload_ingreso = {
        "type": "ingreso",
        "amount": 10000.00,
        "category": "extraordinario",
        "description": "Servicio de escaneo 3D",
    }
    resp = http_client.post("/api/cashbox/movements", json=payload_ingreso, headers=auth_headers)
    assert resp.status_code == 201

    # Listar movimientos
    resp = http_client.get("/api/cashbox/movements", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.get_json()
    assert len(items) == 2

    # Filtrar por tipo egreso
    resp_filtered = http_client.get("/api/cashbox/movements?type=egreso", headers=auth_headers)
    assert resp_filtered.status_code == 200
    filtered_items = resp_filtered.get_json()
    assert len(filtered_items) == 1
    assert filtered_items[0]["category"] == "filamento"

    # Consultar resumen actualizado
    resp_summary = http_client.get("/api/cashbox/summary", headers=auth_headers)
    assert resp_summary.status_code == 200
    summary = resp_summary.get_json()
    assert summary["total_ingresos"] == 10000.00
    assert summary["total_egresos"] == 7500.00
    assert summary["current_balance"] == 2500.00


def test_create_movement_validation_errors(http_client, auth_headers):
    # Tipo inválido
    resp = http_client.post(
        "/api/cashbox/movements",
        json={"type": "invalid", "amount": 100, "category": "otro"},
        headers=auth_headers,
    )
    assert resp.status_code == 422

    # Monto negativo
    resp = http_client.post(
        "/api/cashbox/movements",
        json={"type": "ingreso", "amount": -100, "category": "otro"},
        headers=auth_headers,
    )
    assert resp.status_code == 422

    # Categoría vacía
    resp = http_client.post(
        "/api/cashbox/movements",
        json={"type": "ingreso", "amount": 100, "category": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.parametrize("amount", ["NaN", "sNaN", "Infinity", "-Infinity", "100.005"])
def test_create_movement_rejects_non_finite_or_sub_cent_amount(app, http_client, auth_headers, amount):
    resp = http_client.post(
        "/api/cashbox/movements",
        json={"type": "ingreso", "amount": amount, "category": "otro"},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert "amount" in resp.get_json()["errors"]

    with app.app_context():
        assert CashMovement.query.count() == 0


@pytest.mark.parametrize("amount", ["NaN", "sNaN", "Infinity", "-Infinity", "100.005"])
def test_collect_balance_rejects_non_finite_or_sub_cent_amount(app, http_client, auth_headers, amount):
    order_id = _seed_order_for_test(app, informed_price="15000.00")

    resp = http_client.post(
        f"/api/cashbox/orders/{order_id}/collect-balance",
        json={"amount": amount},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert "amount" in resp.get_json()["errors"]

    with app.app_context():
        assert CashMovement.query.filter_by(order_id=order_id).count() == 0


def test_order_balance_and_collect_routes(app, http_client, auth_headers):
    order_id = _seed_order_for_test(app, informed_price="15000.00")

    # Registrar seña inicial previa
    with app.app_context():
        mov = CashMovement(type="ingreso", amount=Decimal("5000.00"), category="seña", order_id=order_id, user_id=1)
        db.session.add(mov)
        db.session.commit()

    # Consultar balance del pedido
    resp = http_client.get(f"/api/cashbox/orders/{order_id}/balance", headers=auth_headers)
    assert resp.status_code == 200
    balance_info = resp.get_json()
    assert balance_info["informed_price"] == 15000.00
    assert balance_info["total_paid"] == 5000.00
    assert balance_info["pending_balance"] == 10000.00

    # Cobrar saldo parcial
    resp = http_client.post(
        f"/api/cashbox/orders/{order_id}/collect-balance",
        json={"amount": 4000.00, "description": "Pago parcial de entrega"},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    # Verificar que el saldo bajó a 6000
    resp = http_client.get(f"/api/cashbox/orders/{order_id}/balance", headers=auth_headers)
    assert resp.get_json()["pending_balance"] == 6000.00

    # Cobrar el resto completo (sin especificar amount)
    resp = http_client.post(f"/api/cashbox/orders/{order_id}/collect-balance", headers=auth_headers)
    assert resp.status_code == 201
    assert resp.get_json()["amount"] == 6000.00

    # Consultar balance nuevamente: saldo 0
    resp = http_client.get(f"/api/cashbox/orders/{order_id}/balance", headers=auth_headers)
    assert resp.get_json()["pending_balance"] == 0.00

    # Intentar cobrar nuevamente debe devolver error 422
    resp = http_client.post(f"/api/cashbox/orders/{order_id}/collect-balance", headers=auth_headers)
    assert resp.status_code == 422


def test_deliver_order_with_collect_balance(app, http_client, auth_headers):
    order_id = _seed_order_for_test(app, informed_price="8000.00")

    # Registrar seña previa de 3000
    with app.app_context():
        mov = CashMovement(type="ingreso", amount=Decimal("3000.00"), category="seña", order_id=order_id, user_id=1)
        db.session.add(mov)
        db.session.commit()

    # Entregar con collect_balance = true
    resp = http_client.post(
        f"/api/orders/{order_id}/deliver",
        json={"collect_balance": True},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "entregado"

    # Verificar que se generó el movimiento de caja por 5000 (8000 - 3000)
    with app.app_context():
        saldo_mov = CashMovement.query.filter_by(order_id=order_id, category="saldo_pedido").first()
        assert saldo_mov is not None
        assert saldo_mov.amount == Decimal("5000.00")


def _seed_ready_order_with_deposit(app, informed_price="8000.00", deposit="3000.00") -> int:
    order_id = _seed_order_for_test(app, informed_price=informed_price)
    with app.app_context():
        db.session.add(
            CashMovement(type="ingreso", amount=Decimal(deposit), category="seña", order_id=order_id, user_id=1)
        )
        db.session.commit()
        db.session.remove()
    return order_id


@pytest.mark.parametrize(
    "final_payment_amount",
    [
        pytest.param("abc", id="non_numeric"),
        pytest.param("5000.01", id="exceeds_pending_by_one_cent"),
        pytest.param("99999.00", id="far_exceeds_pending"),
        pytest.param(0, id="zero"),
        pytest.param(-100, id="negative"),
        pytest.param("NaN", id="nan"),
        pytest.param("Infinity", id="infinity"),
        pytest.param("100.005", id="sub_cent"),
    ],
)
def test_deliver_rejects_invalid_final_payment_amount(app, http_client, auth_headers, final_payment_amount):
    order_id = _seed_ready_order_with_deposit(app)

    resp = http_client.post(
        f"/api/orders/{order_id}/deliver",
        json={"collect_balance": True, "final_payment_amount": final_payment_amount},
        headers=auth_headers,
    )

    assert resp.status_code == 422
    assert "final_payment_amount" in resp.get_json()["errors"]

    with app.app_context():
        assert db.session.get(Order, order_id).status == OrderStatus.LISTO.value
        assert CashMovement.query.filter_by(order_id=order_id, category="saldo_pedido").count() == 0
        assert CashMovement.query.filter_by(order_id=order_id).count() == 1
        assert OrderStatusHistory.query.filter_by(order_id=order_id, to_status="entregado").count() == 0


@pytest.mark.parametrize(
    ("final_payment_amount", "expected_amount"),
    [
        pytest.param("5000.00", Decimal("5000.00"), id="exact_pending_amount"),
        pytest.param("2000.00", Decimal("2000.00"), id="partial_amount"),
        pytest.param("2000.500", Decimal("2000.50"), id="trailing_zeros_beyond_cents"),
    ],
)
def test_deliver_with_valid_final_payment_amount_succeeds(
    app, http_client, auth_headers, final_payment_amount, expected_amount
):
    order_id = _seed_ready_order_with_deposit(app)

    resp = http_client.post(
        f"/api/orders/{order_id}/deliver",
        json={"collect_balance": True, "final_payment_amount": final_payment_amount},
        headers=auth_headers,
    )

    assert resp.status_code == 200
    assert resp.get_json()["status"] == "entregado"

    with app.app_context():
        saldo_movs = CashMovement.query.filter_by(order_id=order_id, category="saldo_pedido").all()
        assert len(saldo_movs) == 1
        assert saldo_movs[0].amount == expected_amount


def test_deliver_collect_balance_without_amount_and_zero_pending_succeeds(app, http_client, auth_headers):
    order_id = _seed_ready_order_with_deposit(app, informed_price="8000.00", deposit="8000.00")

    resp = http_client.post(
        f"/api/orders/{order_id}/deliver",
        json={"collect_balance": True},
        headers=auth_headers,
    )

    assert resp.status_code == 200
    assert resp.get_json()["status"] == "entregado"

    with app.app_context():
        assert CashMovement.query.filter_by(order_id=order_id, category="saldo_pedido").count() == 0


def test_cashbox_routes_unauthorized(http_client):
    assert http_client.get("/api/cashbox/summary").status_code == 401
    assert http_client.get("/api/cashbox/movements").status_code == 401
    assert http_client.post("/api/cashbox/movements", json={}).status_code == 401
    assert http_client.get("/api/cashbox/orders/1/balance").status_code == 401
    assert http_client.post("/api/cashbox/orders/1/collect-balance").status_code == 401


@pytest.fixture
def second_operator_headers(app):
    """Authenticated operator with id != 1, so user_id assertions are not satisfied by the default (1)."""
    from tests.conftest import make_token

    from app.auth.models import User

    with app.app_context():
        user = User(id=2, username="operador2", role="admin", is_active=True)
        user.set_password("operador234")
        db.session.add(user)
        db.session.commit()
        db.session.remove()
    return {"Authorization": f"Bearer {make_token(app, 2)}"}


def test_ex01_balance_reports_pending_and_total_paid(app, http_client, auth_headers):
    order_id = _seed_ready_order_with_deposit(app, informed_price="8000.00", deposit="3000.00")

    resp = http_client.get(f"/api/cashbox/orders/{order_id}/balance", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.get_json()
    assert body["pending_balance"] == 5000.00
    assert body["total_paid"] == 3000.00


def test_ex03_collect_balance_without_amount_collects_full_pending(app, http_client, auth_headers):
    order_id = _seed_ready_order_with_deposit(app, informed_price="8000.00", deposit="3000.00")

    resp = http_client.post(f"/api/cashbox/orders/{order_id}/collect-balance", headers=auth_headers)

    assert resp.status_code == 201
    assert resp.get_json()["amount"] == 5000.00
    with app.app_context():
        saldo_movs = CashMovement.query.filter_by(order_id=order_id, category="saldo_pedido").all()
        assert len(saldo_movs) == 1
        assert saldo_movs[0].type == "ingreso"
        assert saldo_movs[0].amount == Decimal("5000.00")


def test_ex09_deliver_links_balance_income_to_system_category_and_operator(
    app, http_client, second_operator_headers
):
    from app.cashbox.models import CashIncomeCategory

    order_id = _seed_ready_order_with_deposit(app, informed_price="8000.00", deposit="3000.00")

    resp = http_client.post(
        f"/api/orders/{order_id}/deliver",
        json={"collect_balance": True},
        headers=second_operator_headers,
    )

    assert resp.status_code == 200
    assert resp.get_json()["status"] == "entregado"
    with app.app_context():
        saldo_cat = CashIncomeCategory.query.filter_by(code="saldo_pedido", is_system=True).one()
        saldo_movs = CashMovement.query.filter_by(order_id=order_id, category="saldo_pedido").all()
        assert len(saldo_movs) == 1
        assert saldo_movs[0].amount == Decimal("5000.00")
        assert saldo_movs[0].income_category_id == saldo_cat.id
        assert saldo_movs[0].user_id == 2
        assert saldo_movs[0].description == f"Cobro saldo entrega pedido #{order_id}"


def test_ex16_deliver_rejected_when_system_balance_category_inactive(app, http_client, auth_headers):
    from app.cashbox.models import CashIncomeCategory

    order_id = _seed_ready_order_with_deposit(app, informed_price="8000.00", deposit="3000.00")
    with app.app_context():
        # Precondition only reachable through the DB: the API forbids deactivating system categories.
        CashIncomeCategory.query.filter_by(code="saldo_pedido").one().is_active = False
        db.session.commit()
        history_before = OrderStatusHistory.query.filter_by(order_id=order_id).count()
        db.session.remove()

    resp = http_client.post(
        f"/api/orders/{order_id}/deliver",
        json={"collect_balance": True},
        headers=auth_headers,
    )

    assert resp.status_code == 409
    assert "saldo_pedido" in resp.get_json()["error"]
    with app.app_context():
        assert db.session.get(Order, order_id).status == OrderStatus.LISTO.value
        assert CashMovement.query.filter_by(order_id=order_id, category="saldo_pedido").count() == 0
        assert CashMovement.query.filter_by(order_id=order_id).count() == 1
        assert OrderStatusHistory.query.filter_by(order_id=order_id).count() == history_before
