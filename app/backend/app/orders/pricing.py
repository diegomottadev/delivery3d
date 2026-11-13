from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from app.money import DECIMAL_10_2_MAX

TWO_PLACES = Decimal("0.01")


class PricingValidationError(Exception):
    def __init__(self, errors: dict[str, str]):
        self.errors = errors
        super().__init__(str(errors))


@dataclass(frozen=True)
class QuoteResult:
    production_cost: Decimal
    suggested_sale_price: Decimal
    filament_cost: Decimal | None = None
    electricity_cost: Decimal | None = None
    machine_cost: Decimal | None = None
    labor_cost: Decimal | None = None
    labor_cost_per_hour: Decimal | None = None
    labor_time_minutes: int | None = None


def _to_decimal(value, field: str, errors: dict[str, str]) -> Decimal | None:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError):
        errors[field] = f"{field} must be a valid number"
        return None


def _round(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _check_capacity(value: Decimal, field: str, errors: dict[str, str]) -> None:
    if value > DECIMAL_10_2_MAX:
        errors[field] = f"{field} exceeds allowed precision/range (max {DECIMAL_10_2_MAX})"


def compute_quote(items: list[dict], quote_vars: dict) -> QuoteResult:
    """Pure calculation, no DB/Flask dependency. Raises PricingValidationError on invalid input.

    items: [{weight_g, print_time_minutes, quantity, material_cost_per_kg}, ...] — one entry
        per OrderItem (each may reference a different Material, hence a per-item cost/kg).
    quote_vars: {waste_purge_pct, machine_power_watts, kwh_cost, machine_cost_per_hour,
        labor_cost, profit_margin_pct} — the OrderQuote parameters (apply to the whole job).
    """
    errors: dict[str, str] = {}

    if not items:
        errors["items"] = "at least one item is required to calculate a quote"
        raise PricingValidationError(errors)

    waste_purge_pct = _to_decimal(quote_vars.get("waste_purge_pct"), "waste_purge_pct", errors)
    machine_power_watts = _to_decimal(quote_vars.get("machine_power_watts"), "machine_power_watts", errors)
    kwh_cost = _to_decimal(quote_vars.get("kwh_cost"), "kwh_cost", errors)
    machine_cost_per_hour = _to_decimal(quote_vars.get("machine_cost_per_hour"), "machine_cost_per_hour", errors)

    labor_cost_per_hour = None
    labor_time_minutes = None
    if "labor_cost_per_hour" in quote_vars:
        labor_cost_per_hour = _to_decimal(quote_vars.get("labor_cost_per_hour", 0), "labor_cost_per_hour", errors)
        labor_time_minutes = _to_decimal(quote_vars.get("labor_time_minutes", 0), "labor_time_minutes", errors)
        if labor_cost_per_hour is not None:
            if labor_cost_per_hour < 0:
                errors["labor_cost_per_hour"] = "labor_cost_per_hour must be zero or a positive value"
            else:
                labor_cost_per_hour = _round(labor_cost_per_hour)
        if labor_time_minutes is not None and labor_time_minutes < 0:
            errors["labor_time_minutes"] = "labor_time_minutes must be zero or a positive value"
        if not errors and labor_cost_per_hour is not None and labor_time_minutes is not None:
            labor_cost = _round(labor_cost_per_hour * (labor_time_minutes / Decimal(60)))
        else:
            labor_cost = Decimal(0)
    else:
        labor_cost = _to_decimal(quote_vars.get("labor_cost", 0), "labor_cost", errors)
        if labor_cost is not None:
            if labor_cost < 0:
                errors["labor_cost"] = "labor_cost must be zero or a positive value"
            else:
                labor_cost = _round(labor_cost)
        labor_cost_per_hour = labor_cost
        labor_time_minutes = Decimal(60) if (labor_cost and labor_cost > 0) else Decimal(0)

    profit_multiplier = None
    profit_margin_pct = None
    if "profit_multiplier" in quote_vars and quote_vars["profit_multiplier"] is not None:
        profit_multiplier = _to_decimal(quote_vars.get("profit_multiplier"), "profit_multiplier", errors)
        if profit_multiplier is not None:
            if profit_multiplier <= 0:
                errors["profit_multiplier"] = "profit_multiplier must be greater than 0"
            else:
                profit_margin_pct = (profit_multiplier - 1) * 100
    elif "profit_margin_pct" in quote_vars and quote_vars["profit_margin_pct"] is not None:
        profit_margin_pct = _to_decimal(quote_vars.get("profit_margin_pct"), "profit_margin_pct", errors)
        if profit_margin_pct is not None:
            if profit_margin_pct < 0:
                errors["profit_margin_pct"] = "profit_margin_pct must be zero or a positive value"
            else:
                profit_multiplier = 1 + profit_margin_pct / 100
    else:
        errors["profit_multiplier"] = "profit_multiplier or profit_margin_pct is required"

    parsed_items = []
    for idx, item in enumerate(items):
        weight_g = _to_decimal(item.get("weight_g"), f"items[{idx}].weight_g", errors)
        quantity = _to_decimal(item.get("quantity", 1), f"items[{idx}].quantity", errors)
        material_cost_per_kg = _to_decimal(
            item.get("material_cost_per_kg"), f"items[{idx}].material_cost_per_kg", errors
        )
        print_time_minutes = _to_decimal(
            item.get("print_time_minutes"), f"items[{idx}].print_time_minutes", errors
        )
        parsed_items.append((weight_g, quantity, material_cost_per_kg, print_time_minutes))

    if errors:
        raise PricingValidationError(errors)

    for field, value in (
        ("waste_purge_pct", waste_purge_pct),
        ("machine_power_watts", machine_power_watts),
        ("kwh_cost", kwh_cost),
        ("machine_cost_per_hour", machine_cost_per_hour),
        ("labor_cost", labor_cost),
    ):
        if value is not None and value < 0:
            errors[field] = f"{field} must be zero or a positive value"

    total_time_minutes = Decimal(0)
    filament_cost = Decimal(0)
    for idx, (weight_g, quantity, material_cost_per_kg, print_time_minutes) in enumerate(parsed_items):
        if weight_g <= 0:
            errors[f"items[{idx}].weight_g"] = "weight_g must be greater than 0"
        if quantity <= 0:
            errors[f"items[{idx}].quantity"] = "quantity must be greater than 0"
        if print_time_minutes <= 0:
            errors[f"items[{idx}].print_time_minutes"] = "print_time_minutes must be greater than 0"
        if material_cost_per_kg < 0:
            errors[f"items[{idx}].material_cost_per_kg"] = "material_cost_per_kg must be zero or a positive value"

        if errors:
            continue

        purge_adjusted_weight_g = weight_g * quantity * (1 + waste_purge_pct / 100)
        item_filament_cost = _round((purge_adjusted_weight_g / 1000) * material_cost_per_kg)
        _check_capacity(item_filament_cost, f"items[{idx}].filament_cost", errors)
        filament_cost += item_filament_cost
        total_time_minutes += print_time_minutes * quantity

    if errors:
        raise PricingValidationError(errors)

    print_time_hours = total_time_minutes / Decimal(60)
    electricity_cost = _round((machine_power_watts / 1000) * print_time_hours * kwh_cost)
    machine_cost = _round(machine_cost_per_hour * print_time_hours)

    _check_capacity(filament_cost, "filament_cost", errors)
    _check_capacity(electricity_cost, "electricity_cost", errors)
    _check_capacity(machine_cost, "machine_cost", errors)
    if errors:
        raise PricingValidationError(errors)

    production_cost = filament_cost + electricity_cost + machine_cost + labor_cost
    _check_capacity(production_cost, "production_cost", errors)
    if errors:
        raise PricingValidationError(errors)

    suggested_sale_price = _round(production_cost * profit_multiplier)
    _check_capacity(suggested_sale_price, "suggested_sale_price", errors)
    if errors:
        raise PricingValidationError(errors)

    return QuoteResult(
        production_cost=production_cost,
        suggested_sale_price=suggested_sale_price,
        filament_cost=filament_cost,
        electricity_cost=electricity_cost,
        machine_cost=machine_cost,
        labor_cost=labor_cost,
        labor_cost_per_hour=labor_cost_per_hour,
        labor_time_minutes=int(labor_time_minutes) if labor_time_minutes is not None else None,
    )
