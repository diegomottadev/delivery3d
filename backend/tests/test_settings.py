def test_get_settings(http_client, auth_headers):
    resp = http_client.get("/api/settings", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert "kwh_cost" in data
    assert "waste_purge_pct" in data
    assert "labor_cost" in data
    assert "labor_cost_per_hour" in data
    assert "default_labor_time_minutes" in data
    assert "profit_multiplier" in data
    assert data["currency_code"] == "ARS"
    assert data["currency_symbol"] == "AR$"


def test_update_settings(http_client, auth_headers):
    update_payload = {
        "kwh_cost": 290.00,
        "waste_purge_pct": 12.00,
        "labor_cost": 1600.00,
        "labor_cost_per_hour": 700.00,
        "default_labor_time_minutes": 20,
        "profit_multiplier": 3.00,
        "currency_code": "USD",
        "currency_symbol": "US$",
    }
    resp = http_client.put("/api/settings", json=update_payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["kwh_cost"] == 290.00
    assert data["waste_purge_pct"] == 12.00
    assert data["labor_cost"] == 1600.00
    assert data["labor_cost_per_hour"] == 700.00
    assert data["default_labor_time_minutes"] == 20
    assert data["profit_multiplier"] == 3.00
    assert data["currency_code"] == "USD"
    assert data["currency_symbol"] == "US$"


def test_update_settings_invalid_currency(http_client, auth_headers):
    resp = http_client.put("/api/settings", json={"currency_code": "TOOLONG"}, headers=auth_headers)
    assert resp.status_code == 422


def test_settings_unauthorized(http_client):
    resp = http_client.get("/api/settings")
    assert resp.status_code == 401
