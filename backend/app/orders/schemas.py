from decimal import Decimal

from app.clients.models import ClientOrigin


class ValidationError(Exception):
    def __init__(self, errors: dict[str, str]):
        self.errors = errors
        super().__init__(str(errors))


def validate_order_intake(payload: dict) -> dict:
    """Validates POST /api/orders input. Returns cleaned {client_id?, client?, items} or raises."""
    errors: dict[str, str] = {}

    client_id = payload.get("client_id")
    client_payload = payload.get("client")

    if client_id is None and not client_payload:
        errors["client"] = "either client_id or client is required"
    elif client_id is not None and client_payload:
        errors["client"] = "provide either client_id or client, not both"
    elif client_payload:
        client_payload = _validate_client(client_payload, errors)

    items_payload = payload.get("items")
    if not items_payload or not isinstance(items_payload, list):
        errors["items"] = "at least one item is required"
        items_payload = []

    cleaned_items = []
    for idx, item in enumerate(items_payload):
        cleaned_items.append(_validate_item(item, idx, errors))

    if errors:
        raise ValidationError(errors)

    return {"client_id": client_id, "client": client_payload, "items": cleaned_items}


def _validate_client(payload: dict, errors: dict[str, str]) -> dict:
    name = (payload.get("name") or "").strip()
    origin = payload.get("origin")
    phone = payload.get("phone")
    instagram_username = payload.get("instagram_username")
    notes = payload.get("notes")

    if not name:
        errors["client.name"] = "client.name is required"
    elif len(name) > 120:
        errors["client.name"] = "client.name must be at most 120 characters"

    valid_origins = {o.value for o in ClientOrigin}
    if origin not in valid_origins:
        errors["client.origin"] = f"client.origin must be one of {sorted(valid_origins)}"

    return {
        "name": name,
        "origin": origin,
        "phone": phone,
        "instagram_username": instagram_username,
        "notes": notes,
    }


def _validate_item(payload: dict, idx: int, errors: dict[str, str]) -> dict:
    material_id = payload.get("material_id")
    filament_id = payload.get("filament_id")
    piece_description = (payload.get("piece_description") or "").strip()
    reference_url = payload.get("reference_url")
    weight_g = payload.get("weight_g")
    print_time_minutes = payload.get("print_time_minutes")
    quantity = payload.get("quantity", 1)
    material_cost_per_kg = payload.get("material_cost_per_kg")
    if material_cost_per_kg is None:
        material_cost_per_kg = payload.get("cost_per_kg")

    if not material_id and not filament_id:
        errors[f"items[{idx}].filament_id"] = "either filament_id or material_id is required"
    if not piece_description:
        errors[f"items[{idx}].piece_description"] = "piece_description is required"
    if reference_url and len(reference_url) > 500:
        errors[f"items[{idx}].reference_url"] = "reference_url must be at most 500 characters"
    if not weight_g or float(weight_g) <= 0:
        errors[f"items[{idx}].weight_g"] = "weight_g must be greater than 0"
    if not print_time_minutes or int(print_time_minutes) <= 0:
        errors[f"items[{idx}].print_time_minutes"] = "print_time_minutes must be greater than 0"
    if quantity is not None and int(quantity) <= 0:
        errors[f"items[{idx}].quantity"] = "quantity must be greater than 0"
    if material_cost_per_kg is not None:
        try:
            val = float(material_cost_per_kg)
            if val <= 0:
                errors[f"items[{idx}].material_cost_per_kg"] = "material_cost_per_kg must be greater than 0"
        except (ValueError, TypeError):
            errors[f"items[{idx}].material_cost_per_kg"] = "material_cost_per_kg must be a valid number"

    res = {
        "material_id": material_id,
        "filament_id": filament_id,
        "piece_description": piece_description,
        "reference_url": reference_url or None,
        "weight_g": weight_g,
        "print_time_minutes": print_time_minutes,
        "quantity": quantity,
    }
    if material_cost_per_kg is not None:
        res["material_cost_per_kg"] = material_cost_per_kg
    return res


def _decimal_or_none(value):
    return str(value) if value is not None else None


def serialize_client(client) -> dict:
    return {
        "id": client.id,
        "name": client.name,
        "origin": client.origin,
        "phone": client.phone,
        "instagram_username": client.instagram_username,
        "notes": client.notes,
    }


def serialize_item(item) -> dict:
    cost = item.material_cost_per_kg
    if cost is None and item.material:
        cost = item.material.cost_per_kg
    filament_name = item.filament.name if item.filament else (item.material.type if item.material else None)
    return {
        "id": item.id,
        "material_id": item.material_id,
        "filament_id": item.filament_id,
        "filament_name": filament_name,
        "material_cost_per_kg": _decimal_or_none(cost),
        "piece_description": item.piece_description,
        "reference_url": item.reference_url,
        "weight_g": _decimal_or_none(item.weight_g),
        "print_time_minutes": item.print_time_minutes,
        "quantity": item.quantity,
    }


def serialize_history_entry(entry) -> dict:
    return {
        "from_status": entry.from_status,
        "to_status": entry.to_status,
        "changed_by": entry.changed_by,
        "changed_at": entry.changed_at.isoformat(),
    }


def serialize_order_history(order) -> dict:
    return {
        "order_id": order.id,
        "status": order.status,
        "history": [serialize_history_entry(h) for h in order.status_history],
    }


def serialize_order(order, pricing=None) -> dict:
    quote = order.quote
    pricing_dict = None
    if pricing:
        pricing_dict = {
            "production_cost": _decimal_or_none(pricing.production_cost),
            "suggested_sale_price": _decimal_or_none(pricing.suggested_sale_price),
            "filament_cost": _decimal_or_none(pricing.filament_cost),
            "electricity_cost": _decimal_or_none(pricing.electricity_cost),
            "machine_cost": _decimal_or_none(pricing.machine_cost),
            "labor_cost": _decimal_or_none(pricing.labor_cost),
            "labor_cost_per_hour": _decimal_or_none(pricing.labor_cost_per_hour),
            "labor_time_minutes": pricing.labor_time_minutes,
        }

    return {
        "id": order.id,
        "status": order.status,
        "created_by": order.user_id,
        "created_at": order.created_at.isoformat(),
        "client": serialize_client(order.client),
        "items": [serialize_item(item) for item in order.items],
        "quote": {
            "printer_id": quote.printer_id,
            "printer_name": quote.printer.name if quote.printer else None,
            "waste_purge_pct": _decimal_or_none(quote.waste_purge_pct),
            "machine_power_watts": _decimal_or_none(quote.machine_power_watts),
            "kwh_cost": _decimal_or_none(quote.kwh_cost),
            "machine_cost_per_hour": _decimal_or_none(quote.machine_cost_per_hour),
            "labor_cost": _decimal_or_none(quote.labor_cost),
            "labor_cost_per_hour": _decimal_or_none(quote.labor_cost_per_hour),
            "labor_time_minutes": quote.labor_time_minutes,
            "profit_margin_pct": _decimal_or_none(quote.profit_margin_pct),
            "profit_multiplier": _decimal_or_none((Decimal(1) + quote.profit_margin_pct / Decimal(100)).quantize(Decimal("0.01")))
            if quote.profit_margin_pct is not None
            else None,
            "informed_price": _decimal_or_none(quote.informed_price),
            "quoted_at": quote.quoted_at.isoformat() if quote.quoted_at else None,
        }
        if quote
        else None,
        "production_cost": _decimal_or_none(pricing.production_cost) if pricing else None,
        "suggested_sale_price": _decimal_or_none(pricing.suggested_sale_price) if pricing else None,
        "pricing": pricing_dict,
    }
