from decimal import Decimal

from app.cashbox.models import CashMovement
from app.extensions import db
from app.orders.models import Order, OrderItem, OrderQuote, OrderStatus, OrderStatusHistory

QUOTE_VARS = {
    "waste_purge_pct": 5.00,
    "machine_power_watts": 120.00,
    "kwh_cost": 150.00,
    "machine_cost_per_hour": 300.00,
    "labor_cost": 1500.00,
    "profit_margin_pct": 40.00,
}


def test_delete_order_nuevo(http_client, auth_headers, material, app):
    payload = {
        "client": {"name": "Test Delete", "origin": "whatsapp"},
        "items": [
            {
                "material_id": material,
                "piece_description": "Pieza a Borrar",
                "weight_g": "50.000",
                "print_time_minutes": 60,
                "quantity": 1,
            }
        ],
    }
    create_resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
    assert create_resp.status_code == 201
    order_id = create_resp.json["id"]

    with app.app_context():
        assert db.session.get(Order, order_id) is not None
        assert OrderItem.query.filter_by(order_id=order_id).count() == 1
        assert OrderStatusHistory.query.filter_by(order_id=order_id).count() >= 1

    del_resp = http_client.delete(f"/api/orders/{order_id}", headers=auth_headers)
    assert del_resp.status_code == 200
    assert "eliminado" in del_resp.json.get("message", "").lower()

    with app.app_context():
        assert db.session.get(Order, order_id) is None
        assert OrderItem.query.filter_by(order_id=order_id).count() == 0
        assert OrderStatusHistory.query.filter_by(order_id=order_id).count() == 0


def test_delete_order_presupuestado_with_quote(http_client, auth_headers, material, app):
    payload = {
        "client": {"name": "Test Delete Quote", "origin": "whatsapp"},
        "items": [
            {
                "material_id": material,
                "piece_description": "Pieza Cotizada",
                "weight_g": "20.000",
                "print_time_minutes": 30,
                "quantity": 1,
            }
        ],
    }
    create_resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
    order_id = create_resp.json["id"]

    calc_resp = http_client.post(
        f"/api/orders/{order_id}/quote", json={"quote_vars": QUOTE_VARS}, headers=auth_headers
    )
    assert calc_resp.status_code == 200

    conf_resp = http_client.post(
        f"/api/orders/{order_id}/quote/confirm",
        json={"informed_price": 2500.00},
        headers=auth_headers,
    )
    assert conf_resp.status_code == 200
    assert conf_resp.json["status"] == OrderStatus.PRESUPUESTADO.value

    with app.app_context():
        assert OrderQuote.query.filter_by(order_id=order_id).first() is not None

    del_resp = http_client.delete(f"/api/orders/{order_id}", headers=auth_headers)
    assert del_resp.status_code == 200

    with app.app_context():
        assert db.session.get(Order, order_id) is None
        assert OrderQuote.query.filter_by(order_id=order_id).first() is None


def test_delete_order_aprobado_disassociates_cash_movement(http_client, auth_headers, material, app):
    payload = {
        "client": {"name": "Test Delete With Deposit", "origin": "whatsapp"},
        "items": [
            {
                "material_id": material,
                "piece_description": "Pieza con Seña",
                "weight_g": "30.000",
                "print_time_minutes": 45,
                "quantity": 1,
            }
        ],
    }
    order_id = http_client.post("/api/orders", json=payload, headers=auth_headers).json["id"]
    http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": QUOTE_VARS}, headers=auth_headers)
    http_client.post(f"/api/orders/{order_id}/quote/confirm", json={"informed_price": 3000.00}, headers=auth_headers)

    appr_resp = http_client.post(
        f"/api/orders/{order_id}/approve", json={"deposit_amount": 1500.00}, headers=auth_headers
    )
    assert appr_resp.status_code == 200

    with app.app_context():
        movement = CashMovement.query.filter_by(order_id=order_id).first()
        assert movement is not None
        assert Decimal(str(movement.amount)) == Decimal("1500.00")
        mov_id = movement.id

    del_resp = http_client.delete(f"/api/orders/{order_id}", headers=auth_headers)
    assert del_resp.status_code == 200

    with app.app_context():
        assert db.session.get(Order, order_id) is None
        preserved_mov = db.session.get(CashMovement, mov_id)
        assert preserved_mov is not None
        assert preserved_mov.order_id is None
        assert Decimal(str(preserved_mov.amount)) == Decimal("1500.00")


def test_delete_order_not_found(http_client, auth_headers):
    resp = http_client.delete("/api/orders/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert "not found" in resp.json.get("error", "").lower()


def test_delete_order_unauthenticated(http_client):
    resp = http_client.delete("/api/orders/1")
    assert resp.status_code == 401
