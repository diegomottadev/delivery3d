import pytest


QUOTE_VARS = {
    "waste_purge_pct": 5.00,
    "machine_power_watts": 120.00,
    "kwh_cost": 150.0000,
    "machine_cost_per_hour": 300.00,
    "labor_cost": 1500.00,
    "profit_margin_pct": 40.00,
}


def _presupuestado_order(http_client, auth_headers, material):
    payload = {
        "client": {"name": "Maria Fernandez", "origin": "whatsapp", "phone": "+54 9 11 5555-1234"},
        "items": [
            {
                "material_id": material,
                "piece_description": "Soporte para auricular",
                "weight_g": 120.00,
                "print_time_minutes": 210,
                "quantity": 1,
            }
        ],
    }
    order_id = http_client.post("/api/orders", json=payload, headers=auth_headers).get_json()["id"]
    http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": QUOTE_VARS}, headers=auth_headers)
    http_client.post(f"/api/orders/{order_id}/quote/confirm", json={"informed_price": 6800.00}, headers=auth_headers)
    return order_id


@pytest.fixture
def second_operator_headers(app):
    """Authenticated operator with id != 1, so user_id assertions are not satisfied by the default (1)."""
    from tests.conftest import make_token

    from app.auth.models import User
    from app.extensions import db

    with app.app_context():
        user = User(id=2, username="operador2", role="admin", is_active=True)
        user.set_password("operador234")
        db.session.add(user)
        db.session.commit()
        db.session.remove()
    return {"Authorization": f"Bearer {make_token(app, 2)}"}


def _delete_system_deposit_category(app):
    """Precondition only reachable through the DB: the API forbids deleting system categories."""
    from app.cashbox.models import CashIncomeCategory
    from app.extensions import db

    with app.app_context():
        db.session.delete(CashIncomeCategory.query.filter_by(code="seña", is_system=True).one())
        db.session.commit()
        db.session.remove()


def _history_count(app, order_id):
    from app.extensions import db
    from app.orders.models import OrderStatusHistory

    with app.app_context():
        count = OrderStatusHistory.query.filter_by(order_id=order_id).count()
        db.session.remove()
    return count


class TestApprove:
    def test_happy_path_no_deposit(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        resp = http_client.post(f"/api/orders/{order_id}/approve", json={}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "aprobado"

    def test_happy_path_with_deposit_creates_cash_movement(self, http_client, auth_headers, material, app):
        from app.cashbox.models import CashMovement

        order_id = _presupuestado_order(http_client, auth_headers, material)
        resp = http_client.post(
            f"/api/orders/{order_id}/approve", json={"deposit_amount": 1500.00}, headers=auth_headers
        )
        assert resp.status_code == 200

        with app.app_context():
            movements = CashMovement.query.filter_by(order_id=order_id).all()
            assert len(movements) == 1
            assert str(movements[0].amount) == "1500.00"
            assert movements[0].type == "ingreso"
            assert movements[0].category == "seña"

    def test_ex07_deposit_linked_to_system_category_and_authenticated_operator(
        self, http_client, auth_headers, second_operator_headers, material, app
    ):
        from app.cashbox.models import CashIncomeCategory, CashMovement

        order_id = _presupuestado_order(http_client, auth_headers, material)
        resp = http_client.post(
            f"/api/orders/{order_id}/approve", json={"deposit_amount": 1500.00}, headers=second_operator_headers
        )
        assert resp.status_code == 200

        with app.app_context():
            sena_cat = CashIncomeCategory.query.filter_by(code="seña", is_system=True).one()
            movements = CashMovement.query.filter_by(order_id=order_id).all()
            assert len(movements) == 1
            assert str(movements[0].amount) == "1500.00"
            assert movements[0].income_category_id == sena_cat.id
            assert movements[0].user_id == 2
            assert movements[0].description == f"Seña inicial pedido #{order_id}"

    def test_zero_deposit_does_not_create_cash_movement(self, http_client, auth_headers, material, app):
        from app.cashbox.models import CashMovement

        order_id = _presupuestado_order(http_client, auth_headers, material)
        resp = http_client.post(f"/api/orders/{order_id}/approve", json={"deposit_amount": 0.00}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "aprobado"

        with app.app_context():
            assert CashMovement.query.filter_by(order_id=order_id).count() == 0

    def test_negative_deposit_rejected(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        resp = http_client.post(f"/api/orders/{order_id}/approve", json={"deposit_amount": -0.01}, headers=auth_headers)
        assert resp.status_code == 422

    def test_order_still_nuevo_rejected(self, http_client, auth_headers, material):
        payload = {
            "client": {"name": "X", "origin": "whatsapp"},
            "items": [{"material_id": material, "piece_description": "p", "weight_g": 10, "print_time_minutes": 10}],
        }
        order_id = http_client.post("/api/orders", json=payload, headers=auth_headers).get_json()["id"]
        resp = http_client.post(f"/api/orders/{order_id}/approve", json={}, headers=auth_headers)
        assert resp.status_code == 409

    def test_already_aprobado_rejected(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/approve", json={}, headers=auth_headers)
        resp = http_client.post(f"/api/orders/{order_id}/approve", json={}, headers=auth_headers)
        assert resp.status_code == 409

    def test_unauthorized_without_jwt(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        resp = http_client.post(f"/api/orders/{order_id}/approve", json={})
        assert resp.status_code == 401

    def test_non_numeric_deposit_rejected(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        resp = http_client.post(
            f"/api/orders/{order_id}/approve", json={"deposit_amount": "not-a-number"}, headers=auth_headers
        )
        assert resp.status_code == 422

    def test_deposit_exceeding_decimal_capacity_rejected(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        resp = http_client.post(
            f"/api/orders/{order_id}/approve", json={"deposit_amount": 100000000.00}, headers=auth_headers
        )
        assert resp.status_code == 422

    @pytest.mark.parametrize("deposit_amount", ["NaN", "sNaN", "Infinity", "-Infinity", "1500.005"])
    def test_non_finite_or_sub_cent_deposit_rejected(self, http_client, auth_headers, material, app, deposit_amount):
        from app.cashbox.models import CashMovement
        from app.extensions import db
        from app.orders.models import Order

        order_id = _presupuestado_order(http_client, auth_headers, material)
        resp = http_client.post(
            f"/api/orders/{order_id}/approve", json={"deposit_amount": deposit_amount}, headers=auth_headers
        )
        assert resp.status_code == 422
        assert "deposit_amount" in resp.get_json()["errors"]

        with app.app_context():
            assert db.session.get(Order, order_id).status == "presupuestado"
            assert CashMovement.query.filter_by(order_id=order_id).count() == 0

    def test_service_rejects_deposit_on_non_approve_transition_directly(self, http_client, auth_headers, material, app):
        """Defense in depth: routes.py already blocks this before calling the service,
        but transition_order must reject it too if ever called directly (e.g. a future
        internal caller)."""
        from app.orders.services import DepositValidationError, transition_order

        order_id = _presupuestado_order(http_client, auth_headers, material)
        with app.app_context():
            try:
                transition_order(order_id, "aprobado", changed_by=1, deposit_amount=100)
                transition_order(order_id, "imprimiendo", changed_by=1, deposit_amount=50)
                raise AssertionError("expected DepositValidationError")
            except DepositValidationError as exc:
                assert "deposit_amount" in exc.errors


class TestApproveRequiresSystemDepositCategory:
    def test_ex15_deposit_rejected_when_system_deposit_category_missing(
        self, http_client, auth_headers, material, app
    ):
        from app.cashbox.models import CashMovement
        from app.extensions import db
        from app.orders.models import Order

        order_id = _presupuestado_order(http_client, auth_headers, material)
        _delete_system_deposit_category(app)
        history_before = _history_count(app, order_id)

        resp = http_client.post(
            f"/api/orders/{order_id}/approve", json={"deposit_amount": 1500.00}, headers=auth_headers
        )

        assert resp.status_code == 409
        assert "seña" in resp.get_json()["error"]
        with app.app_context():
            assert db.session.get(Order, order_id).status == "presupuestado"
            assert CashMovement.query.filter_by(order_id=order_id).count() == 0
        assert _history_count(app, order_id) == history_before

    def test_ex17_zero_deposit_approves_without_system_deposit_category(
        self, http_client, auth_headers, material, app
    ):
        from app.cashbox.models import CashMovement

        order_id = _presupuestado_order(http_client, auth_headers, material)
        _delete_system_deposit_category(app)

        resp = http_client.post(
            f"/api/orders/{order_id}/approve", json={"deposit_amount": 0.00}, headers=auth_headers
        )

        assert resp.status_code == 200
        assert resp.get_json()["status"] == "aprobado"
        with app.app_context():
            assert CashMovement.query.filter_by(order_id=order_id).count() == 0

    def test_ex18_user_category_named_sena_does_not_replace_system_category(
        self, http_client, auth_headers, material, app
    ):
        from app.cashbox.models import CashIncomeCategory, CashMovement
        from app.extensions import db
        from app.orders.models import Order

        order_id = _presupuestado_order(http_client, auth_headers, material)
        _delete_system_deposit_category(app)
        with app.app_context():
            db.session.add(CashIncomeCategory(code="anticipo_cliente", name="seña", is_system=False, is_active=True))
            db.session.commit()
            db.session.remove()
        history_before = _history_count(app, order_id)

        resp = http_client.post(
            f"/api/orders/{order_id}/approve", json={"deposit_amount": 1500.00}, headers=auth_headers
        )

        assert resp.status_code == 409
        with app.app_context():
            assert db.session.get(Order, order_id).status == "presupuestado"
            assert CashMovement.query.filter_by(order_id=order_id).count() == 0
        assert _history_count(app, order_id) == history_before


class TestStartPrinting:
    def test_happy_path(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/approve", json={}, headers=auth_headers)
        resp = http_client.post(f"/api/orders/{order_id}/start-printing", json={}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "imprimiendo"

    def test_deposit_amount_on_this_endpoint_rejected(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/approve", json={}, headers=auth_headers)
        resp = http_client.post(
            f"/api/orders/{order_id}/start-printing", json={"deposit_amount": 500.00}, headers=auth_headers
        )
        assert resp.status_code == 422

    def test_skipping_from_presupuestado_rejected(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        resp = http_client.post(f"/api/orders/{order_id}/start-printing", json={}, headers=auth_headers)
        assert resp.status_code == 409

    def test_nonexistent_order_returns_404(self, http_client, auth_headers):
        resp = http_client.post("/api/orders/99999/start-printing", json={}, headers=auth_headers)
        assert resp.status_code == 404


class TestMarkReady:
    def test_happy_path(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/approve", json={}, headers=auth_headers)
        http_client.post(f"/api/orders/{order_id}/start-printing", json={}, headers=auth_headers)
        resp = http_client.post(f"/api/orders/{order_id}/mark-ready", json={}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "listo"

    def test_skipping_from_aprobado_rejected(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/approve", json={}, headers=auth_headers)
        resp = http_client.post(f"/api/orders/{order_id}/mark-ready", json={}, headers=auth_headers)
        assert resp.status_code == 409


class TestDeliver:
    def test_happy_path(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/approve", json={}, headers=auth_headers)
        http_client.post(f"/api/orders/{order_id}/start-printing", json={}, headers=auth_headers)
        http_client.post(f"/api/orders/{order_id}/mark-ready", json={}, headers=auth_headers)
        resp = http_client.post(f"/api/orders/{order_id}/deliver", json={}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "entregado"

    def test_terminal_state_rejects_every_further_transition(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        for endpoint in ("approve", "start-printing", "mark-ready", "deliver"):
            http_client.post(f"/api/orders/{order_id}/{endpoint}", json={}, headers=auth_headers)

        for endpoint in ("approve", "start-printing", "mark-ready", "deliver"):
            resp = http_client.post(f"/api/orders/{order_id}/{endpoint}", json={}, headers=auth_headers)
            assert resp.status_code == 409, endpoint

    def test_skipping_two_states_rejected(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/approve", json={}, headers=auth_headers)
        resp = http_client.post(f"/api/orders/{order_id}/deliver", json={}, headers=auth_headers)
        assert resp.status_code == 409


class TestOrderHistory:
    def test_full_history_in_chronological_order(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/approve", json={}, headers=auth_headers)
        http_client.post(f"/api/orders/{order_id}/start-printing", json={}, headers=auth_headers)

        resp = http_client.get(f"/api/orders/{order_id}/history", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["status"] == "imprimiendo"
        transitions = [(h["from_status"], h["to_status"]) for h in body["history"]]
        assert transitions == [
            (None, "nuevo"),
            ("nuevo", "presupuestado"),
            ("presupuestado", "aprobado"),
            ("aprobado", "imprimiendo"),
        ]

    def test_freshly_quoted_order_has_two_entries(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        resp = http_client.get(f"/api/orders/{order_id}/history", headers=auth_headers)
        assert len(resp.get_json()["history"]) == 2

    def test_nonexistent_order_returns_404(self, http_client, auth_headers):
        resp = http_client.get("/api/orders/99999/history", headers=auth_headers)
        assert resp.status_code == 404

    def test_unauthorized_without_jwt(self, http_client, auth_headers, material):
        order_id = _presupuestado_order(http_client, auth_headers, material)
        resp = http_client.get(f"/api/orders/{order_id}/history")
        assert resp.status_code == 401
