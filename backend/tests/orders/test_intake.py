import pytest

from app.extensions import db
from app.orders.models import OrderStatusHistory


def _item(material_id, **overrides):
    base = {
        "material_id": material_id,
        "piece_description": "Soporte para auricular",
        "reference_url": None,
        "weight_g": 50.00,
        "print_time_minutes": 90,
        "quantity": 1,
    }
    base.update(overrides)
    return base


def _client_payload(**overrides):
    base = {"name": "Maria Fernandez", "origin": "whatsapp", "phone": "+54 9 11 5555-1234"}
    base.update(overrides)
    return base


class TestManualOrderIntake:
    def test_ex01_happy_path_creates_order_in_nuevo_status(self, http_client, auth_headers, material):
        payload = {"client": _client_payload(), "items": [_item(material)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        body = resp.get_json()
        assert body["status"] == "nuevo"
        assert body["created_by"] == 1
        assert body["client"]["name"] == "Maria Fernandez"
        assert len(body["items"]) == 1

    def test_creates_order_against_an_existing_client_id(self, http_client, auth_headers, material):
        first = http_client.post(
            "/api/orders", json={"client": _client_payload(), "items": [_item(material)]}, headers=auth_headers
        ).get_json()
        client_id = first["client"]["id"]

        resp = http_client.post(
            "/api/orders", json={"client_id": client_id, "items": [_item(material)]}, headers=auth_headers
        )
        assert resp.status_code == 201
        assert resp.get_json()["client"]["id"] == client_id

    def test_multiple_items_with_different_materials(self, http_client, auth_headers, app):
        from app.materials.models import Material

        with app.app_context():
            m1 = Material(brand="eSun", type="PLA", color="Rojo", cost_per_kg="18000.00")
            m2 = Material(brand="Bambu Lab", type="PETG", color="Negro", cost_per_kg="22000.00")
            db.session.add_all([m1, m2])
            db.session.commit()
            m1_id, m2_id = m1.id, m2.id
            db.session.remove()

        payload = {
            "client": _client_payload(),
            "items": [_item(m1_id, piece_description="pieza A"), _item(m2_id, piece_description="pieza B", quantity=2)],
        }
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        assert len(resp.get_json()["items"]) == 2

    def test_creates_order_with_custom_material_cost_per_kg(self, http_client, auth_headers, material):
        payload = {
            "client": _client_payload(),
            "items": [_item(material, material_cost_per_kg=25000.00)],
        }
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        item = resp.get_json()["items"][0]
        assert item["material_cost_per_kg"] == "25000.00"

    def test_creates_order_with_filament_id_directly(self, http_client, auth_headers, filament):
        item = {
            "filament_id": filament,
            "material_cost_per_kg": 19500.00,
            "piece_description": "Carcasa sensor",
            "weight_g": 35.0,
            "print_time_minutes": 45,
            "quantity": 2,
        }
        payload = {
            "client": _client_payload(),
            "items": [item],
        }
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        res_item = resp.get_json()["items"][0]
        assert res_item["filament_id"] == filament
        assert res_item["filament_name"] == "PLA"
        assert res_item["material_cost_per_kg"] == "19500.00"

    def test_creates_order_with_three_decimal_weight(self, http_client, auth_headers, material):
        payload = {
            "client": _client_payload(),
            "items": [_item(material, weight_g=50.125)],
        }
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        order_id = resp.get_json()["id"]
        assert resp.get_json()["items"][0]["weight_g"] == "50.125"

        get_resp = http_client.get(f"/api/orders/{order_id}", headers=auth_headers)
        assert get_resp.status_code == 200
        assert get_resp.get_json()["items"][0]["weight_g"] == "50.125"

    def test_neither_material_nor_filament_rejected(self, http_client, auth_headers):
        item = {
            "piece_description": "Carcasa sensor",
            "weight_g": 35.0,
            "print_time_minutes": 45,
        }
        payload = {"client": _client_payload(), "items": [item]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_missing_client_and_client_id_rejected(self, http_client, auth_headers, material):
        payload = {"items": [_item(material)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_both_client_and_client_id_rejected(self, http_client, auth_headers, material):
        payload = {"client_id": 999, "client": _client_payload(), "items": [_item(material)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_invalid_client_origin_rejected(self, http_client, auth_headers, material):
        payload = {"client": _client_payload(origin="carrier_pigeon"), "items": [_item(material)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_no_items_rejected(self, http_client, auth_headers):
        payload = {"client": _client_payload(), "items": []}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_item_missing_material_id_rejected(self, http_client, auth_headers):
        payload = {"client": _client_payload(), "items": [_item(None)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_item_zero_weight_rejected(self, http_client, auth_headers, material):
        payload = {"client": _client_payload(), "items": [_item(material, weight_g=0)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_nonexistent_material_id_rejected(self, http_client, auth_headers):
        payload = {"client": _client_payload(), "items": [_item(999999)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_missing_jwt_is_unauthorized(self, http_client, material):
        payload = {"client": _client_payload(), "items": [_item(material)]}
        resp = http_client.post("/api/orders", json=payload)
        assert resp.status_code == 401


class TestOrderStatusHistoryRecordedOnIntake:
    def test_creates_exactly_one_history_row(self, http_client, auth_headers, material, app):
        payload = {"client": _client_payload(), "items": [_item(material)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        order_id = resp.get_json()["id"]

        with app.app_context():
            rows = OrderStatusHistory.query.filter_by(order_id=order_id).all()
            assert len(rows) == 1
            assert rows[0].from_status is None
            assert rows[0].to_status == "nuevo"
            assert rows[0].changed_by == 1
            db.session.remove()


class TestListOrders:
    def test_returns_all_existing_orders(self, http_client, auth_headers, material):
        for i in range(3):
            http_client.post(
                "/api/orders",
                json={"client": _client_payload(name=f"cliente {i}"), "items": [_item(material)]},
                headers=auth_headers,
            )
        resp = http_client.get("/api/orders", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.get_json()) == 3

    def test_empty_collection_returns_empty_array(self, http_client, auth_headers):
        resp = http_client.get("/api/orders", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_unauthorized_without_jwt(self, http_client):
        resp = http_client.get("/api/orders")
        assert resp.status_code == 401


class TestRetrieveOrderById:
    def test_returns_existing_order(self, http_client, auth_headers, material):
        created = http_client.post(
            "/api/orders", json={"client": _client_payload(), "items": [_item(material)]}, headers=auth_headers
        ).get_json()

        resp = http_client.get(f"/api/orders/{created['id']}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["id"] == created["id"]

    def test_nonexistent_id_returns_404(self, http_client, auth_headers):
        resp = http_client.get("/api/orders/99999", headers=auth_headers)
        assert resp.status_code == 404

    def test_unauthorized_without_jwt(self, http_client):
        resp = http_client.get("/api/orders/1")
        assert resp.status_code == 401


class TestSecurityEdgeCases:
    def test_empty_client_name_rejected(self, http_client, auth_headers, material):
        payload = {"client": _client_payload(name="   "), "items": [_item(material)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_malformed_jwt_is_unauthorized(self, http_client, material):
        payload = {"client": _client_payload(), "items": [_item(material)]}
        resp = http_client.post(
            "/api/orders", json=payload, headers={"Authorization": "Bearer not-a-real-jwt"}
        )
        assert resp.status_code == 401

    def test_client_name_over_limit_rejected(self, http_client, auth_headers, material):
        payload = {"client": _client_payload(name="a" * 121), "items": [_item(material)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_item_missing_piece_description_rejected(self, http_client, auth_headers, material):
        payload = {"client": _client_payload(), "items": [_item(material, piece_description="")]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_item_reference_url_over_limit_rejected(self, http_client, auth_headers, material):
        payload = {"client": _client_payload(), "items": [_item(material, reference_url="https://x.test/" + "c" * 500)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_item_missing_print_time_rejected(self, http_client, auth_headers, material):
        payload = {"client": _client_payload(), "items": [_item(material, print_time_minutes=0)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_item_zero_quantity_rejected(self, http_client, auth_headers, material):
        payload = {"client": _client_payload(), "items": [_item(material, quantity=0)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_nonexistent_client_id_rejected(self, http_client, auth_headers, material):
        payload = {"client_id": 999999, "items": [_item(material)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422


class TestUpdateOrder:
    def test_update_order_in_nuevo_status(self, http_client, auth_headers, material, filament):
        create_payload = {"client": _client_payload(name="Carlos Ruiz"), "items": [_item(material)]}
        resp = http_client.post("/api/orders", json=create_payload, headers=auth_headers)
        assert resp.status_code == 201
        order_id = resp.get_json()["id"]

        update_payload = {
            "client": _client_payload(name="Carlos Ruiz Modificado", phone="+54 9 11 9999-8888"),
            "items": [
                {
                    "filament_id": filament,
                    "material_cost_per_kg": 21000.00,
                    "piece_description": "Pieza Modificada",
                    "reference_url": "https://makerworld.com/mod",
                    "weight_g": 85.5,
                    "print_time_minutes": 150,
                    "quantity": 3,
                }
            ],
        }
        put_resp = http_client.put(f"/api/orders/{order_id}", json=update_payload, headers=auth_headers)
        assert put_resp.status_code == 200
        data = put_resp.get_json()
        assert data["id"] == order_id
        assert data["status"] == "nuevo"
        assert data["client"]["name"] == "Carlos Ruiz Modificado"
        assert data["client"]["phone"] == "+54 9 11 9999-8888"
        assert len(data["items"]) == 1
        assert data["items"][0]["piece_description"] == "Pieza Modificada"
        assert data["items"][0]["quantity"] == 3
        assert float(data["items"][0]["weight_g"]) == 85.5
        assert data["items"][0]["print_time_minutes"] == 150

    def test_update_order_in_any_step_preserves_status(self, http_client, auth_headers, material, filament):
        create_payload = {"client": _client_payload(name="Ana Gomez"), "items": [_item(material)]}
        created = http_client.post("/api/orders", json=create_payload, headers=auth_headers).get_json()
        order_id = created["id"]

        quote_vars = {
            "waste_purge_pct": 5.00,
            "machine_power_watts": 120.00,
            "kwh_cost": 150.0000,
            "machine_cost_per_hour": 300.00,
            "labor_cost": 1500.00,
            "profit_margin_pct": 40.00,
        }
        # Advance to presupuestado
        q_resp = http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": quote_vars}, headers=auth_headers)
        assert q_resp.status_code == 200
        c_resp = http_client.post(
            f"/api/orders/{order_id}/quote/confirm",
            json={"informed_price": 5000.00},
            headers=auth_headers,
        )
        assert c_resp.status_code == 200
        # Advance to aprobado
        app_resp = http_client.post(f"/api/orders/{order_id}/approve", json={}, headers=auth_headers)
        assert app_resp.status_code == 200
        # Advance to imprimiendo
        pr_resp = http_client.post(f"/api/orders/{order_id}/start-printing", json={}, headers=auth_headers)
        assert pr_resp.status_code == 200

        current = http_client.get(f"/api/orders/{order_id}", headers=auth_headers).get_json()
        assert current["status"] == "imprimiendo"

        # Now edit the order while it is in 'imprimiendo' status
        update_payload = {
            "client": _client_payload(name="Ana Gomez Actualizada"),
            "items": [
                {
                    "filament_id": filament,
                    "material_cost_per_kg": 20000.00,
                    "piece_description": "Pieza actualizada durante impresion",
                    "weight_g": 60.0,
                    "print_time_minutes": 120,
                    "quantity": 2,
                }
            ],
        }
        put_resp = http_client.put(f"/api/orders/{order_id}", json=update_payload, headers=auth_headers)
        assert put_resp.status_code == 200
        data = put_resp.get_json()
        assert data["status"] == "imprimiendo"
        assert data["client"]["name"] == "Ana Gomez Actualizada"
        assert len(data["items"]) == 1
        assert data["items"][0]["piece_description"] == "Pieza actualizada durante impresion"
        assert data["items"][0]["quantity"] == 2

    def test_update_nonexistent_order_returns_404(self, http_client, auth_headers, filament):
        update_payload = {
            "client": _client_payload(),
            "items": [
                {
                    "filament_id": filament,
                    "material_cost_per_kg": 20000.00,
                    "piece_description": "Pieza",
                    "weight_g": 50.0,
                    "print_time_minutes": 60,
                    "quantity": 1,
                }
            ],
        }
        resp = http_client.put("/api/orders/99999", json=update_payload, headers=auth_headers)
        assert resp.status_code == 404

    def test_update_order_invalid_payload_returns_422(self, http_client, auth_headers, material):
        create_payload = {"client": _client_payload(), "items": [_item(material)]}
        created = http_client.post("/api/orders", json=create_payload, headers=auth_headers).get_json()
        order_id = created["id"]

        bad_payload = {"client": _client_payload(name=""), "items": []}
        resp = http_client.put(f"/api/orders/{order_id}", json=bad_payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_update_order_unauthorized(self, http_client):
        resp = http_client.put("/api/orders/1", json={})
        assert resp.status_code == 401


def _filament_only_item(filament_id, **overrides):
    base = {
        "filament_id": filament_id,
        "piece_description": "Carcasa sensor",
        "weight_g": 35.0,
        "print_time_minutes": 45,
        "quantity": 1,
    }
    base.update(overrides)
    return base


class TestItemDefaultCostPerKg:
    def test_ex12_item_without_cost_takes_material_cost_per_kg(self, http_client, auth_headers, app):
        from app.materials.models import Material

        with app.app_context():
            m = Material(brand="Bambu Lab", type="PETG", color="Negro", cost_per_kg="25000.00")
            db.session.add(m)
            db.session.commit()
            m_id = m.id
            db.session.remove()

        payload = {"client": _client_payload(), "items": [_item(m_id)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        assert resp.get_json()["items"][0]["material_cost_per_kg"] == "25000.00"

    def test_ex13_filament_only_item_defaults_cost_per_kg_on_create(self, http_client, auth_headers, filament):
        payload = {"client": _client_payload(), "items": [_filament_only_item(filament)]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        assert resp.get_json()["items"][0]["material_cost_per_kg"] == "18000.00"

    def test_ex14_filament_only_item_defaults_cost_per_kg_on_update(
        self, http_client, auth_headers, material, filament
    ):
        created = http_client.post(
            "/api/orders", json={"client": _client_payload(), "items": [_item(material)]}, headers=auth_headers
        ).get_json()

        update_payload = {
            "client": _client_payload(),
            "items": [_filament_only_item(filament, piece_description="Pieza nueva sin costo")],
        }
        resp = http_client.put(f"/api/orders/{created['id']}", json=update_payload, headers=auth_headers)
        assert resp.status_code == 200
        items = resp.get_json()["items"]
        assert len(items) == 1
        assert items[0]["material_cost_per_kg"] == "18000.00"

    @pytest.mark.parametrize("field", ["material_cost_per_kg", "cost_per_kg"])
    @pytest.mark.parametrize("zero", [0, 0.0, "0.00"])
    def test_zero_cost_per_kg_rejected_instead_of_defaulting(self, http_client, auth_headers, filament, field, zero):
        payload = {"client": _client_payload(), "items": [_filament_only_item(filament, **{field: zero})]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422
        assert "items[0].material_cost_per_kg" in resp.get_json()["errors"]

    def test_zero_cost_per_kg_rejected_on_update(self, http_client, auth_headers, material, filament):
        created = http_client.post(
            "/api/orders", json={"client": _client_payload(), "items": [_item(material)]}, headers=auth_headers
        ).get_json()
        update_payload = {"client": _client_payload(), "items": [_filament_only_item(filament, material_cost_per_kg=0)]}
        resp = http_client.put(f"/api/orders/{created['id']}", json=update_payload, headers=auth_headers)
        assert resp.status_code == 422
        assert "items[0].material_cost_per_kg" in resp.get_json()["errors"]

    def test_ex14c_item_without_filament_nor_material_rejected(self, http_client, auth_headers):
        item = {"piece_description": "Carcasa sensor", "weight_g": 35.0, "print_time_minutes": 45, "quantity": 1}
        payload = {"client": _client_payload(), "items": [item]}
        resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
        assert resp.status_code == 422
        assert "items[0].filament_id" in resp.get_json()["errors"]
