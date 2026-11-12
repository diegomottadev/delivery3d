from decimal import Decimal

import pytest

from app.orders.pricing import PricingValidationError, compute_quote

EX01_ITEMS = [{"weight_g": 120.00, "quantity": 1, "material_cost_per_kg": 18000.00, "print_time_minutes": 210}]
EX01_QUOTE_VARS = {
    "waste_purge_pct": 5.00,
    "machine_power_watts": 120.00,
    "kwh_cost": 150.0000,
    "machine_cost_per_hour": 300.00,
    "labor_cost": 1500.00,
    "profit_margin_pct": 40.00,
}


class TestComputeQuote:
    def test_ex01_happy_path_single_item(self):
        result = compute_quote(EX01_ITEMS, EX01_QUOTE_VARS)
        assert result.production_cost == Decimal("4881.00")
        assert result.suggested_sale_price == Decimal("6833.40")

    def test_ex02_zero_waste_and_margin(self):
        items = [{"weight_g": 100.00, "quantity": 1, "material_cost_per_kg": 20000.00, "print_time_minutes": 60}]
        quote_vars = {
            "waste_purge_pct": 0.00,
            "machine_power_watts": 100.00,
            "kwh_cost": 100.0000,
            "machine_cost_per_hour": 200.00,
            "labor_cost": 500.00,
            "profit_margin_pct": 0.00,
        }
        result = compute_quote(items, quote_vars)
        assert result.production_cost == Decimal("2710.00")
        assert result.suggested_sale_price == Decimal("2710.00")

    def test_ex03_boundary_plus_one_percent(self):
        items = [{"weight_g": 100.00, "quantity": 1, "material_cost_per_kg": 20000.00, "print_time_minutes": 60}]
        quote_vars = {
            "waste_purge_pct": 1.00,
            "machine_power_watts": 100.00,
            "kwh_cost": 100.0000,
            "machine_cost_per_hour": 200.00,
            "labor_cost": 500.00,
            "profit_margin_pct": 1.00,
        }
        result = compute_quote(items, quote_vars)
        assert result.production_cost == Decimal("2730.00")
        assert result.suggested_sale_price == Decimal("2757.30")

    def test_ex04_negative_weight_rejected(self):
        items = [{"weight_g": -50.00, "quantity": 1, "material_cost_per_kg": 18000.00, "print_time_minutes": 210}]
        with pytest.raises(PricingValidationError) as exc_info:
            compute_quote(items, EX01_QUOTE_VARS)
        assert "items[0].weight_g" in exc_info.value.errors

    def test_ex06_extreme_values_exceed_decimal_capacity(self):
        items = [
            {"weight_g": 99999999.99, "quantity": 1, "material_cost_per_kg": 99999999.99, "print_time_minutes": 60}
        ]
        quote_vars = {
            "waste_purge_pct": 0.00,
            "machine_power_watts": 0.00,
            "kwh_cost": 0.0000,
            "machine_cost_per_hour": 0.00,
            "labor_cost": 0.00,
            "profit_margin_pct": 0.00,
        }
        with pytest.raises(PricingValidationError) as exc_info:
            compute_quote(items, quote_vars)
        assert "items[0].filament_cost" in exc_info.value.errors

    def test_ex07_rounding_half_up_per_component(self):
        quote_vars = dict(EX01_QUOTE_VARS, kwh_cost=150.1234)
        result = compute_quote(EX01_ITEMS, quote_vars)
        assert result.production_cost == Decimal("4881.05")
        assert result.suggested_sale_price == Decimal("6833.47")

    def test_zero_print_time_rejected(self):
        items = [{"weight_g": 100.00, "quantity": 1, "material_cost_per_kg": 18000.00, "print_time_minutes": 0}]
        with pytest.raises(PricingValidationError) as exc_info:
            compute_quote(items, EX01_QUOTE_VARS)
        assert "items[0].print_time_minutes" in exc_info.value.errors

    def test_negative_workshop_variable_rejected(self):
        quote_vars = dict(EX01_QUOTE_VARS, labor_cost=-1)
        with pytest.raises(PricingValidationError) as exc_info:
            compute_quote(EX01_ITEMS, quote_vars)
        assert "labor_cost" in exc_info.value.errors

    def test_no_items_rejected(self):
        with pytest.raises(PricingValidationError) as exc_info:
            compute_quote([], EX01_QUOTE_VARS)
        assert "items" in exc_info.value.errors

    def test_non_numeric_quote_var_rejected(self):
        quote_vars = dict(EX01_QUOTE_VARS, waste_purge_pct="not-a-number")
        with pytest.raises(PricingValidationError) as exc_info:
            compute_quote(EX01_ITEMS, quote_vars)
        assert "waste_purge_pct" in exc_info.value.errors

    def test_non_numeric_item_field_rejected(self):
        items = [{"weight_g": "abc", "quantity": 1, "material_cost_per_kg": 100, "print_time_minutes": 10}]
        with pytest.raises(PricingValidationError) as exc_info:
            compute_quote(items, EX01_QUOTE_VARS)
        assert "items[0].weight_g" in exc_info.value.errors

    def test_zero_quantity_rejected(self):
        items = [{"weight_g": 10, "quantity": 0, "material_cost_per_kg": 100, "print_time_minutes": 10}]
        with pytest.raises(PricingValidationError) as exc_info:
            compute_quote(items, EX01_QUOTE_VARS)
        assert "items[0].quantity" in exc_info.value.errors

    def test_negative_material_cost_per_kg_rejected(self):
        items = [{"weight_g": 10, "quantity": 1, "material_cost_per_kg": -5, "print_time_minutes": 10}]
        with pytest.raises(PricingValidationError) as exc_info:
            compute_quote(items, EX01_QUOTE_VARS)
        assert "items[0].material_cost_per_kg" in exc_info.value.errors

    def test_electricity_cost_alone_exceeds_capacity(self):
        items = [{"weight_g": 1, "quantity": 1, "material_cost_per_kg": 1, "print_time_minutes": 6_000_000}]
        quote_vars = {
            "waste_purge_pct": 0.00,
            "machine_power_watts": 1000.00,
            "kwh_cost": 2000.00,
            "machine_cost_per_hour": 0.00,
            "labor_cost": 0.00,
            "profit_margin_pct": 0.00,
        }
        with pytest.raises(PricingValidationError) as exc_info:
            compute_quote(items, quote_vars)
        assert "electricity_cost" in exc_info.value.errors

    def test_production_cost_sum_exceeds_capacity_even_if_each_component_is_under(self):
        items = [{"weight_g": 1_000_000, "quantity": 1, "material_cost_per_kg": 40_000, "print_time_minutes": 60}]
        quote_vars = {
            "waste_purge_pct": 0.00,
            "machine_power_watts": 0.00,
            "kwh_cost": 0.00,
            "machine_cost_per_hour": 30_000_000.00,
            "labor_cost": 30_000_000.00,
            "profit_margin_pct": 0.00,
        }
        with pytest.raises(PricingValidationError) as exc_info:
            compute_quote(items, quote_vars)
        assert "production_cost" in exc_info.value.errors

    def test_suggested_sale_price_exceeds_capacity_due_to_margin(self):
        items = [{"weight_g": 1_000_000, "quantity": 1, "material_cost_per_kg": 90_000, "print_time_minutes": 60}]
        quote_vars = {
            "waste_purge_pct": 0.00,
            "machine_power_watts": 0.00,
            "kwh_cost": 0.00,
            "machine_cost_per_hour": 0.00,
            "labor_cost": 0.00,
            "profit_margin_pct": 20.00,
        }
        with pytest.raises(PricingValidationError) as exc_info:
            compute_quote(items, quote_vars)
        assert "suggested_sale_price" in exc_info.value.errors

    def test_multi_item_multi_material_sums_filament_cost_and_time(self):
        # Two different pieces, two different materials, quantity > 1 on one of them.
        items = [
            {"weight_g": 50.00, "quantity": 2, "material_cost_per_kg": 18000.00, "print_time_minutes": 90},
            {"weight_g": 30.00, "quantity": 1, "material_cost_per_kg": 22000.00, "print_time_minutes": 45},
        ]
        quote_vars = {
            "waste_purge_pct": 0.00,
            "machine_power_watts": 0.00,
            "kwh_cost": 0.0000,
            "machine_cost_per_hour": 0.00,
            "labor_cost": 0.00,
            "profit_margin_pct": 0.00,
        }
        result = compute_quote(items, quote_vars)
        # item 1: (50*2/1000)*18000 = 1800.00 ; item 2: (30/1000)*22000 = 660.00
        assert result.production_cost == Decimal("2460.00")

    def test_labor_cost_per_hour_and_minutes_formula(self):
        # 15 minutes of labor at $650/hour = 650 * (15/60) = $162.50
        items = [{"weight_g": 100.00, "quantity": 1, "material_cost_per_kg": 20000.00, "print_time_minutes": 60}]
        quote_vars = {
            "waste_purge_pct": 0.00,
            "machine_power_watts": 0.00,
            "kwh_cost": 0.00,
            "machine_cost_per_hour": 0.00,
            "labor_cost_per_hour": 650.00,
            "labor_time_minutes": 15,
            "profit_multiplier": 2.0,
        }
        result = compute_quote(items, quote_vars)
        assert result.labor_cost == Decimal("162.50")
        # filament: 100g @ $20000/kg = $2000.00
        # total cost = 2000.00 + 162.50 = $2162.50
        assert result.production_cost == Decimal("2162.50")
        assert result.suggested_sale_price == Decimal("4325.00")
