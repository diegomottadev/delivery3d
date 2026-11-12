from app.materials.models import Material, MaterialType


class TestListMaterials:
    def test_list_materials_happy_path(self, http_client, auth_headers, app):
        with app.app_context():
            from app.extensions import db

            m1 = Material(brand="eSun", type=MaterialType.PLA.value, color="Blanco", cost_per_kg="18000.00")
            m2 = Material(brand="Bambu Lab", type=MaterialType.PETG.value, color="Negro", cost_per_kg="22000.00")
            db.session.add_all([m1, m2])
            db.session.commit()

        resp = http_client.get("/api/materials", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) >= 2
        colors = [m["color"] for m in data]
        assert "Blanco" in colors
        assert "Negro" in colors
