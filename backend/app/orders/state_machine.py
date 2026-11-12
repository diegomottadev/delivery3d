from app.orders.models import OrderStatus

# Strict 1-to-1 forward map — no reversal (see order-lifecycle proposal.md Out of Scope).
# `cancelado` exists in the OrderStatus enum (normalized-schema design) but has no
# transition wired yet in this change; deliberately left as future scope.
VALID_TRANSITIONS: dict[str, str] = {
    OrderStatus.PRESUPUESTADO.value: OrderStatus.APROBADO.value,
    OrderStatus.APROBADO.value: OrderStatus.IMPRIMIENDO.value,
    OrderStatus.IMPRIMIENDO.value: OrderStatus.LISTO.value,
    OrderStatus.LISTO.value: OrderStatus.ENTREGADO.value,
}


def is_valid_transition(current_status: str, target_status: str) -> bool:
    return VALID_TRANSITIONS.get(current_status) == target_status
