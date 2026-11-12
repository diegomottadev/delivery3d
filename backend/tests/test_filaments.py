def test_list_filaments_happy_path(http_client, auth_headers):
    resp = http_client.get("/api/filaments", headers=auth_headers)
    assert resp.status_code == 200
    filaments = resp.get_json()
    assert len(filaments) >= 2
    names = [f["name"] for f in filaments]
    assert "PLA" in names
    assert "PETG" in names


def test_list_filaments_unauthorized_without_jwt(http_client):
    resp = http_client.get("/api/filaments")
    assert resp.status_code == 401
