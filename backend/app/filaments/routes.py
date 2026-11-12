from flask import Blueprint, jsonify

from app.auth.security import login_required
from app.filaments.models import Filament

filaments_bp = Blueprint("filaments", __name__, url_prefix="/api/filaments")


@filaments_bp.get("")
@login_required
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
