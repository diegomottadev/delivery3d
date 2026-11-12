from decimal import Decimal

CENT = Decimal("0.01")
DECIMAL_10_2_MAX = Decimal("99999999.99")
DEFAULT_MATERIAL_COST_PER_KG = Decimal("18000.00")


def has_sub_cent_precision(value: Decimal) -> bool:
    """True if storing `value` in a DECIMAL(10, 2) column would silently round it.
    Call only on finite values within DECIMAL(10, 2) range."""
    return value != value.quantize(CENT)
