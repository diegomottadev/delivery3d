import pytest


def _create_order(http_client, auth_headers, material, weight_g=120.00, print_time_minutes=210, quantity=1, material_cost_per_kg=None):
    item = {
        "material_id": material,
        "piece_description": "Soporte para auricular",
        "weight_g": weight_g,
        "print_time_minutes": print_time_minutes,
        "quantity": quantity,
    }
    if material_cost_per_kg is not None:
        item["material_cost_per_kg"] = material_cost_per_kg
    payload = {
        "client": {"name": "Maria Fernandez", "origin": "whatsapp", "phone": "+54 9 11 5555-1234"},
        "items": [item],
    }
    resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
    return resp.get_json()["id"]


EX01_QUOTE_VARS = {
    "waste_purge_pct": 5.00,
    "machine_power_watts": 120.00,
    "kwh_cost": 150.0000,
    "machine_cost_per_hour": 300.00,
    "labor_cost": 1500.00,
    "profit_margin_pct": 40.00,
}


class TestCalculateQuote:
    def test_happy_path_computes_cost_without_changing_status(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)

        resp = http_client.post(
            f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["production_cost"] == "4881.00"
        assert body["suggested_sale_price"] == "6833.40"
        assert body["status"] == "nuevo"

    def test_quote_uses_custom_material_cost_per_kg_from_item(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material, material_cost_per_kg=20000.00)

        resp = http_client.post(
            f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers
        )
        assert resp.status_code == 200
        body = resp.get_json()
        # Filament cost: 120 * 1.05 * 20000 / 1000 = 2520.00 (diff +252 vs catalog 18000)
        # Production cost: 4881 + 252 = 5133.00
        assert body["production_cost"] == "5133.00"
        assert body["suggested_sale_price"] == "7186.20"

    def test_recalculating_overwrites_previous_quote_params(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)

        second_vars = dict(EX01_QUOTE_VARS, profit_margin_pct=0.00)
        resp = http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": second_vars}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["suggested_sale_price"] == "4881.00"

    def test_quote_calculation_with_labor_rate_and_minutes(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        vars_with_labor_rate = {
            "waste_purge_pct": 5.00,
            "machine_power_watts": 120.00,
            "kwh_cost": 150.00,
            "machine_cost_per_hour": 300.00,
            "labor_cost_per_hour": 650.00,
            "labor_time_minutes": 15,  # 0.25 h * 650 = 162.50
            "profit_multiplier": 2,
        }
        resp = http_client.post(
            f"/api/orders/{order_id}/quote",
            json={"quote_vars": vars_with_labor_rate},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["quote"]["labor_cost"] == "162.50"
        assert body["quote"]["labor_cost_per_hour"] == "650.00"
        assert body["quote"]["labor_time_minutes"] == 15
        assert body["pricing"]["labor_cost"] == "162.50"
        assert body["pricing"]["labor_cost_per_hour"] == "650.00"
        assert body["pricing"]["labor_time_minutes"] == 15


    def test_quote_calculation_with_profit_multiplier_x2_x3_x4_x5(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        base_vars = {
            "waste_purge_pct": 5.00,
            "machine_power_watts": 120.00,
            "kwh_cost": 150.0000,
            "machine_cost_per_hour": 300.00,
            "labor_cost": 1500.00,
        }
        # x2
        resp = http_client.post(
            f"/api/orders/{order_id}/quote",
            json={"quote_vars": {**base_vars, "profit_multiplier": 2}},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["production_cost"] == "4881.00"
        assert body["suggested_sale_price"] == "9762.00"  # 4881 * 2

        # x3
        resp = http_client.post(
            f"/api/orders/{order_id}/quote",
            json={"quote_vars": {**base_vars, "profit_multiplier": 3}},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.get_json()["suggested_sale_price"] == "14643.00"  # 4881 * 3

        # x4
        resp = http_client.post(
            f"/api/orders/{order_id}/quote",
            json={"quote_vars": {**base_vars, "profit_multiplier": 4}},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.get_json()["suggested_sale_price"] == "19524.00"  # 4881 * 4

        # x5
        resp = http_client.post(
            f"/api/orders/{order_id}/quote",
            json={"quote_vars": {**base_vars, "profit_multiplier": 5}},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.get_json()["suggested_sale_price"] == "24405.00"  # 4881 * 5

    def test_invalid_profit_multiplier_rejected(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        base_vars = {
            "waste_purge_pct": 5.00,
            "machine_power_watts": 120.00,
            "kwh_cost": 150.0000,
            "machine_cost_per_hour": 300.00,
            "labor_cost": 1500.00,
        }
        resp = http_client.post(
            f"/api/orders/{order_id}/quote",
            json={"quote_vars": {**base_vars, "profit_multiplier": 0}},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_negative_variable_rejected(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        bad_vars = dict(EX01_QUOTE_VARS, labor_cost=-1)
        resp = http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": bad_vars}, headers=auth_headers)
        assert resp.status_code == 422

    def test_order_not_in_nuevo_status_allowed(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)
        http_client.post(f"/api/orders/{order_id}/quote/confirm", json={"informed_price": 6800.00}, headers=auth_headers)

        resp = http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["quote"] is not None

    def test_nonexistent_order_returns_404(self, http_client, auth_headers):
        resp = http_client.post("/api/orders/99999/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)
        assert resp.status_code == 404

    def test_unauthorized_without_jwt(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        resp = http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS})
        assert resp.status_code == 401


class TestConfirmQuote:
    def test_happy_path_transitions_to_presupuestado(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)

        resp = http_client.post(f"/api/orders/{order_id}/quote/confirm", json={"informed_price": 6800.00}, headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["status"] == "presupuestado"
        assert body["quote"]["informed_price"] == "6800.00"
        assert body["quote"]["quoted_at"] is not None

    def test_zero_price_rejected(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)

        resp = http_client.post(f"/api/orders/{order_id}/quote/confirm", json={"informed_price": 0.00}, headers=auth_headers)
        assert resp.status_code == 422

    def test_negative_price_rejected(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)

        resp = http_client.post(f"/api/orders/{order_id}/quote/confirm", json={"informed_price": -500.00}, headers=auth_headers)
        assert resp.status_code == 422

    def test_reconfirming_already_quoted_order_updates_price(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)
        http_client.post(f"/api/orders/{order_id}/quote/confirm", json={"informed_price": 6800.00}, headers=auth_headers)

        resp = http_client.post(f"/api/orders/{order_id}/quote/confirm", json={"informed_price": 7000.00}, headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["quote"]["informed_price"] == "7000.00"

    def test_reconfirming_quote_on_order_in_imprimiendo_preserves_status(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)
        http_client.post(f"/api/orders/{order_id}/quote/confirm", json={"informed_price": 6800.00}, headers=auth_headers)
        http_client.post(f"/api/orders/{order_id}/approve", headers=auth_headers)
        http_client.post(f"/api/orders/{order_id}/start-printing", headers=auth_headers)

        new_vars = dict(EX01_QUOTE_VARS, kwh_cost=300.00)
        calc_resp = http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": new_vars}, headers=auth_headers)
        assert calc_resp.status_code == 200
        assert calc_resp.get_json()["status"] == "imprimiendo"

        conf_resp = http_client.post(f"/api/orders/{order_id}/quote/confirm", json={"informed_price": 7500.00}, headers=auth_headers)
        assert conf_resp.status_code == 200
        body = conf_resp.get_json()
        assert body["status"] == "imprimiendo"
        assert body["quote"]["informed_price"] == "7500.00"

    def test_confirming_without_prior_calculation_rejected(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        resp = http_client.post(f"/api/orders/{order_id}/quote/confirm", json={"informed_price": 6800.00}, headers=auth_headers)
        assert resp.status_code == 409

    def test_nonexistent_order_returns_404(self, http_client, auth_headers):
        resp = http_client.post("/api/orders/99999/quote/confirm", json={"informed_price": 100}, headers=auth_headers)
        assert resp.status_code == 404

    def test_unauthorized_without_jwt(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)
        resp = http_client.post(f"/api/orders/{order_id}/quote/confirm", json={"informed_price": 6800.00})
        assert resp.status_code == 401

    def test_non_numeric_price_rejected(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)

        resp = http_client.post(
            f"/api/orders/{order_id}/quote/confirm", json={"informed_price": "not-a-number"}, headers=auth_headers
        )
        assert resp.status_code == 422

    def test_price_exceeding_decimal_capacity_rejected(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)

        resp = http_client.post(
            f"/api/orders/{order_id}/quote/confirm", json={"informed_price": 100000000.00}, headers=auth_headers
        )
        assert resp.status_code == 422

    @pytest.mark.parametrize("informed_price", ["NaN", "sNaN", "6800.005", "6800.001"])
    def test_non_finite_or_sub_cent_price_rejected(self, http_client, auth_headers, material, informed_price):
        order_id = _create_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)

        resp = http_client.post(
            f"/api/orders/{order_id}/quote/confirm", json={"informed_price": informed_price}, headers=auth_headers
        )
        assert resp.status_code == 422
        assert "informed_price" in resp.get_json()["errors"]
        assert http_client.get(f"/api/orders/{order_id}", headers=auth_headers).get_json()["status"] == "nuevo"

    def test_price_with_trailing_zeros_beyond_cents_accepted(self, http_client, auth_headers, material):
        order_id = _create_order(http_client, auth_headers, material)
        http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": EX01_QUOTE_VARS}, headers=auth_headers)

        resp = http_client.post(
            f"/api/orders/{order_id}/quote/confirm", json={"informed_price": "6800.500"}, headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.get_json()["quote"]["informed_price"] == "6800.50"
