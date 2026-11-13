from decimal import Decimal
from flask import Blueprint, jsonify

from app.http import json_body
from app.rbac.constants import Perm
from app.rbac.security import permission_required
from app.extensions import db
from app.printers.models import Printer
from app.settings.services import get_or_create_settings

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")


@settings_bp.get("")
@permission_required(Perm.SETTINGS_READ)
def get_settings_route():
    settings = get_or_create_settings()
    return jsonify(settings.to_dict()), 200


@settings_bp.put("")
@permission_required(Perm.SETTINGS_UPDATE)
def update_settings_route():
    settings = get_or_create_settings()
    data = json_body()

    if "kwh_cost" in data:
        try:
            val = Decimal(str(data["kwh_cost"]))
            if val < 0:
                return jsonify(error="El costo de kWh no puede ser negativo"), 422
            settings.kwh_cost = val
        except Exception:
            return jsonify(error="El costo de kWh debe ser un número válido"), 422

    if "waste_purge_pct" in data:
        try:
            val = Decimal(str(data["waste_purge_pct"]))
            if val < 0:
                return jsonify(error="La merma/purga no puede ser negativa"), 422
            settings.waste_purge_pct = val
        except Exception:
            return jsonify(error="La merma/purga debe ser un número válido"), 422

    if "labor_cost" in data:
        try:
            val = Decimal(str(data["labor_cost"]))
            if val < 0:
                return jsonify(error="La mano de obra no puede ser negativa"), 422
            settings.labor_cost = val
        except Exception:
            return jsonify(error="La mano de obra debe ser un número válido"), 422

    if "labor_cost_per_hour" in data:
        try:
            val = Decimal(str(data["labor_cost_per_hour"]))
            if val < 0:
                return jsonify(error="El costo de mano de obra por hora no puede ser negativo"), 422
            settings.labor_cost_per_hour = val
        except Exception:
            return jsonify(error="El costo de mano de obra por hora debe ser un número válido"), 422

    if "default_labor_time_minutes" in data:
        try:
            val = int(data["default_labor_time_minutes"])
            if val < 0:
                return jsonify(error="El tiempo de mano de obra no puede ser negativo"), 422
            settings.default_labor_time_minutes = val
        except Exception:
            return jsonify(error="El tiempo de mano de obra debe ser un número entero"), 422

    if "profit_multiplier" in data:
        try:
            val = Decimal(str(data["profit_multiplier"]))
            if val < 1:
                return jsonify(error="El multiplicador de ganancia debe ser al menos 1"), 422
            settings.profit_multiplier = val
        except Exception:
            return jsonify(error="El multiplicador de ganancia debe ser un número válido"), 422

    if "default_printer_id" in data:
        printer_id = data["default_printer_id"]
        if printer_id is not None:
            printer = db.session.get(Printer, printer_id)
            if not printer:
                return jsonify(error="La impresora seleccionada no existe"), 422
            settings.default_printer_id = printer.id
        else:
            settings.default_printer_id = None

    if "currency_code" in data:
        code = str(data["currency_code"]).strip().upper()
        if not code or len(code) > 3:
            return jsonify(error="El código de moneda debe tener entre 1 y 3 caracteres"), 422
        settings.currency_code = code

    if "currency_symbol" in data:
        symbol = str(data["currency_symbol"]).strip()
        if not symbol or len(symbol) > 10:
            return jsonify(error="El símbolo de moneda debe tener entre 1 y 10 caracteres"), 422
        settings.currency_symbol = symbol

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify(error=str(exc)), 500

    return jsonify(settings.to_dict()), 200
