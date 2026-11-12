from flask import Blueprint, jsonify

from app.rbac.constants import Perm
from app.rbac.security import permission_required
from app.filaments.models import Filament

filaments_bp = Blueprint("filaments", __name__, url_prefix="/api/filaments")


@filaments_bp.get("")
@permission_required(Perm.FILAMENTS_READ)
def list_filaments_route():
    filaments = Filament.query.order_by(Filament.name).all()
    return (
        jsonify(
            [
                {
                    "id": f.id,
                    "name": f.name,
                }
                for f in filaments
            ]
        ),
        200,
    )
