from flask import Blueprint, jsonify

from app.rbac.constants import Perm
from app.rbac.security import permission_required
from app.materials.models import Material

materials_bp = Blueprint("materials", __name__, url_prefix="/api/materials")


@materials_bp.get("")
@permission_required(Perm.MATERIALS_READ)
def list_materials_route():
    materials = Material.query.order_by(Material.brand, Material.type, Material.color).all()
    return (
        jsonify(
            [
                {
                    "id": m.id,
                    "brand": m.brand,
                    "type": m.type,
                    "color": m.color,
                    "cost_per_kg": str(m.cost_per_kg),
                }
                for m in materials
            ]
        ),
        200,
    )
