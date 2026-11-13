"""Seeds a minimal starter catalog of filaments so order_items has valid material_id
options. Full materials CRUD is out of scope for order-intake/quote-calculation — see
openspec/changes/order-intake/design.md.

Usage: .venv/bin/python -m seeds.seed_materials
"""

from app import create_app
from app.extensions import db
from app.materials.models import Material, MaterialType

STARTER_MATERIALS = [
    {"brand": "eSun", "type": MaterialType.PLA.value, "color": "Blanco", "cost_per_kg": "18000.00"},
    {"brand": "eSun", "type": MaterialType.PLA.value, "color": "Negro", "cost_per_kg": "18000.00"},
    {"brand": "Bambu Lab", "type": MaterialType.PETG.value, "color": "Negro", "cost_per_kg": "22000.00"},
]


def run() -> None:
    app = create_app()
    with app.app_context():
        created = 0
        for entry in STARTER_MATERIALS:
            exists = Material.query.filter_by(
                brand=entry["brand"], type=entry["type"], color=entry["color"]
            ).first()
            if exists:
                continue
            db.session.add(Material(**entry))
            created += 1
        db.session.commit()
        print(f"Seeded {created} new material(s); {len(STARTER_MATERIALS) - created} already existed.")


if __name__ == "__main__":
    run()
