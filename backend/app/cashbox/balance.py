"""Pending-balance rules for an order (single source of truth for "saldo pendiente")."""

from decimal import Decimal

from app.cashbox.models import CashMovement, CashMovementType
from app.extensions import db
from app.orders.models import Order

ZERO = Decimal("0.00")


def informed_price(order: Order) -> Decimal:
    """The price informed to the client, or 0.00 if the order has no quote/price yet."""
    if order.quote and order.quote.informed_price is not None:
        return Decimal(str(order.quote.informed_price))
    return ZERO


def total_paid(order_id: int) -> Decimal:
    """SUM of the order's income movements; expenses are excluded."""
    paid = (
        db.session.query(db.func.coalesce(db.func.sum(CashMovement.amount), 0))
        .filter(CashMovement.order_id == order_id, CashMovement.type == CashMovementType.INGRESO.value)
        .scalar()
    )
    return Decimal(str(paid))


def pending_from(informed: Decimal, paid: Decimal) -> Decimal:
    """max(0, informed - paid)."""
    return max(ZERO, informed - paid)


def pending_balance(order: Order) -> Decimal:
    return pending_from(informed_price(order), total_paid(order.id))
