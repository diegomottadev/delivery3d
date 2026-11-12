from decimal import Decimal
from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from app.http import json_body
from app.auth.security import login_required
from app.extensions import db
from app.printers.models import Printer

printers_bp = Blueprint("printers", __name__, url_prefix="/api/printers")


@printers_bp.get("")
@login_required
def list_printers_route():
    include_inactive = request.args.get("include_inactive", "false").lower() in ("true", "1")
    query = Printer.query
    if not include_inactive:
        query = query.filter_by(is_active=True)
    printers = query.order_by(Printer.name).all()
    return jsonify([p.to_dict() for p in printers]), 200


@printers_bp.post("")
@login_required
def create_printer_route():
    data = json_body()
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify(error="El nombre de la impresora es obligatorio"), 422

    try:
        power_watts = Decimal(str(data.get("power_watts", "0")))
        if power_watts <= 0:
            return jsonify(error="La potencia en Watts debe ser mayor a 0"), 422
    except Exception:
        return jsonify(error="La potencia en Watts debe ser un número válido"), 422

    try:
        cost_per_hour = Decimal(str(data.get("cost_per_hour", "0")))
        if cost_per_hour < 0:
            return jsonify(error="La amortización/costo por hora no puede ser negativa"), 422
    except Exception:
        return jsonify(error="La amortización/costo por hora debe ser un número válido"), 422

    printer = Printer(
        name=name,
        model=(data.get("model") or "").strip() or None,
        power_watts=power_watts,
        cost_per_hour=cost_per_hour,
        is_active=bool(data.get("is_active", True)),
    )

    try:
        db.session.add(printer)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error=f"Ya existe una impresora con el nombre '{name}'"), 409
    except Exception as exc:
        db.session.rollback()
        return jsonify(error=str(exc)), 500

    return jsonify(printer.to_dict()), 201


@printers_bp.put("/<int:printer_id>")
@login_required
def update_printer_route(printer_id: int):
    printer = db.session.get(Printer, printer_id)
    if not printer:
        return jsonify(error="Impresora no encontrada"), 404

    data = json_body()
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify(error="El nombre no puede estar vacío"), 422
        printer.name = name

    if "model" in data:
        printer.model = (data.get("model") or "").strip() or None

    if "power_watts" in data:
        try:
            val = Decimal(str(data["power_watts"]))
            if val <= 0:
                return jsonify(error="La potencia debe ser mayor a 0"), 422
            printer.power_watts = val
        except Exception:
            return jsonify(error="Potencia inválida"), 422

    if "cost_per_hour" in data:
        try:
            val = Decimal(str(data["cost_per_hour"]))
            if val < 0:
                return jsonify(error="El costo por hora no puede ser negativo"), 422
            printer.cost_per_hour = val
        except Exception:
            return jsonify(error="Costo por hora inválido"), 422

    if "is_active" in data:
        printer.is_active = bool(data["is_active"])

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="Ya existe otra impresora con ese nombre"), 409
    except Exception as exc:
        db.session.rollback()
        return jsonify(error=str(exc)), 500

    return jsonify(printer.to_dict()), 200
