def test_list_printers(http_client, auth_headers):
    resp = http_client.get("/api/printers", headers=auth_headers)
    assert resp.status_code == 200
    printers = resp.get_json()
    assert isinstance(printers, list)


def test_create_and_update_printer(http_client, auth_headers):
    create_payload = {
        "name": "Prusa MK4 Test",
        "model": "MK4",
        "power_watts": 140.0,
        "cost_per_hour": 110.0,
    }
    resp = http_client.post("/api/printers", json=create_payload, headers=auth_headers)
    assert resp.status_code == 201
    created = resp.get_json()
    assert created["name"] == "Prusa MK4 Test"
    assert created["power_watts"] == 140.0
    assert created["cost_per_hour"] == 110.0
    printer_id = created["id"]

    update_payload = {
        "cost_per_hour": 125.0,
    }
    resp_update = http_client.put(f"/api/printers/{printer_id}", json=update_payload, headers=auth_headers)
    assert resp_update.status_code == 200
    assert resp_update.get_json()["cost_per_hour"] == 125.0


def test_printers_unauthorized(http_client):
    resp = http_client.get("/api/printers")
    assert resp.status_code == 401
