import logging
from decimal import Decimal

from app.cashbox.balance import pending_balance
from app.cashbox.models import CashIncomeCategory, CashMovement, CashMovementType
from app.cashbox.services import add_movement
from app.clients.models import Client
from app.extensions import db
from app.filaments.models import Filament
from app.materials.models import Material
from app.money import DECIMAL_10_2_MAX, DEFAULT_MATERIAL_COST_PER_KG, has_sub_cent_precision
from app.orders.models import Order, OrderItem, OrderQuote, OrderStatus, OrderStatusHistory, _utcnow
from app.orders.pricing import QuoteResult, compute_quote
from app.orders.state_machine import is_valid_transition

audit_logger = logging.getLogger("delivery3d.audit")


class OrderNotFoundError(Exception):
    pass


class ClientNotFoundError(Exception):
    pass


class MaterialNotFoundError(Exception):
    pass


class FilamentNotFoundError(Exception):
    pass


class InvalidOrderStateError(Exception):
    """Precondition failure: order not in the required status for this operation."""


class InformedPriceValidationError(Exception):
    def __init__(self, errors: dict[str, str]):
        self.errors = errors
        super().__init__(str(errors))


class DepositValidationError(Exception):
    def __init__(self, errors: dict[str, str]):
        self.errors = errors
        super().__init__(str(errors))


def _get_or_create_client(client_id: int | None, client_payload: dict | None) -> Client:
    if client_id is not None:
        client = db.session.get(Client, client_id)
        if client is None:
            raise ClientNotFoundError(f"Client {client_id} not found")
        return client

    client = Client(
        name=client_payload["name"],
        origin=client_payload["origin"],
        phone=client_payload.get("phone"),
        instagram_username=client_payload.get("instagram_username"),
        notes=client_payload.get("notes"),
    )
    db.session.add(client)
    db.session.flush()
    return client


def _resolve_cost_per_kg(item: dict, material: Material | None) -> Decimal:
    """Explicit item cost, else the material's cost, else the default."""
    cost_per_kg = item.get("material_cost_per_kg")
    if cost_per_kg is None:
        cost_per_kg = item.get("cost_per_kg")
    if cost_per_kg is None and material is not None:
        cost_per_kg = material.cost_per_kg
    if cost_per_kg is None:
        cost_per_kg = DEFAULT_MATERIAL_COST_PER_KG
    return cost_per_kg


def _build_order_item(order_id: int, item: dict) -> OrderItem:
    material_id = item.get("material_id")
    filament_id = item.get("filament_id")
    material = None
    if material_id is not None:
        material = db.session.get(Material, material_id)
        if material is None:
            raise MaterialNotFoundError(f"Material {material_id} not found")

    filament = None
    if filament_id is not None:
        filament = db.session.get(Filament, filament_id)
        if filament is None:
            raise FilamentNotFoundError(f"Filament {filament_id} not found")

    return OrderItem(
        order_id=order_id,
        material_id=material.id if material else None,
        filament_id=filament.id if filament else None,
        material_cost_per_kg=_resolve_cost_per_kg(item, material),
        piece_description=item["piece_description"],
        reference_url=item.get("reference_url"),
        weight_g=item["weight_g"],
        print_time_minutes=item["print_time_minutes"],
        quantity=item.get("quantity", 1),
    )


def create_order(items: list[dict], created_by: int, client_id: int | None = None, client: dict | None = None) -> Order:
    try:
        client_row = _get_or_create_client(client_id, client)

        order = Order(client_id=client_row.id, user_id=created_by, status=OrderStatus.NUEVO.value)
        db.session.add(order)
        db.session.flush()

        for item in items:
            db.session.add(_build_order_item(order.id, item))

        db.session.add(
            OrderStatusHistory(
                order_id=order.id,
                from_status=None,
                to_status=OrderStatus.NUEVO.value,
                changed_by=created_by,
            )
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return order


def update_order(
    order_id: int,
    items: list[dict],
    client: dict | None = None,
    client_id: int | None = None,
) -> Order:
    order = db.session.get(Order, order_id)
    if order is None:
        raise OrderNotFoundError(f"Order {order_id} not found")

    try:
        if client_id is not None and client_id != order.client_id:
            new_client = db.session.get(Client, client_id)
            if new_client is None:
                raise ClientNotFoundError(f"Client {client_id} not found")
            order.client_id = new_client.id
        elif client is not None and order.client:
            order.client.name = client["name"]
            order.client.origin = client["origin"]
            order.client.phone = client.get("phone")
            order.client.instagram_username = client.get("instagram_username")
            order.client.notes = client.get("notes")

        order.items.clear()
        db.session.flush()

        for item in items:
            order.items.append(_build_order_item(order.id, item))

        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return order


def list_orders(limit: int | None = None, offset: int = 0) -> tuple[list[Order], int]:
    """Pedidos más recientes primero. Devuelve (página, total sin paginar)."""
    query = Order.query.order_by(Order.created_at.desc(), Order.id.desc())
    total = query.count()
    if offset:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)
    return query.all(), total


def get_order(order_id: int) -> Order:
    order = db.session.get(Order, order_id)
    if order is None:
        raise OrderNotFoundError(f"Order {order_id} not found")
    return order


def _pricing_items(order: Order) -> list[dict]:
    return [
        {
            "weight_g": item.weight_g,
            "quantity": item.quantity,
            "material_cost_per_kg": (
                item.material_cost_per_kg
                if item.material_cost_per_kg is not None
                else (item.material.cost_per_kg if item.material else DEFAULT_MATERIAL_COST_PER_KG)
            ),
            "print_time_minutes": item.print_time_minutes,
        }
        for item in order.items
    ]


def get_order_pricing(order: Order) -> QuoteResult | None:
    """Computed on read (3FN) — None if the order has no quote params or no items yet."""
    if order.quote is None or not order.items:
        return None

    quote_vars = {
        "waste_purge_pct": order.quote.waste_purge_pct,
        "machine_power_watts": order.quote.machine_power_watts,
        "kwh_cost": order.quote.kwh_cost,
        "machine_cost_per_hour": order.quote.machine_cost_per_hour,
        "labor_cost": order.quote.labor_cost,
        "profit_margin_pct": order.quote.profit_margin_pct,
    }
    if order.quote.labor_cost_per_hour is not None:
        quote_vars["labor_cost_per_hour"] = order.quote.labor_cost_per_hour
    if order.quote.labor_time_minutes is not None:
        quote_vars["labor_time_minutes"] = order.quote.labor_time_minutes
    return compute_quote(_pricing_items(order), quote_vars)


def calculate_quote(order_id: int, quote_vars: dict) -> tuple[Order, QuoteResult]:
    """Creates/overwrites the order's OrderQuote parameters and returns the computed result.
    Does not change order.status — see confirm_quote for the NEW -> PRESUPUESTADO transition."""
    order = get_order(order_id)
    result = compute_quote(_pricing_items(order), quote_vars)  # raises PricingValidationError

    try:
        if order.quote is None:
            order.quote = OrderQuote(order_id=order.id)

        if "printer_id" in quote_vars:
            order.quote.printer_id = quote_vars["printer_id"]
        order.quote.waste_purge_pct = quote_vars["waste_purge_pct"]
        order.quote.machine_power_watts = quote_vars["machine_power_watts"]
        order.quote.kwh_cost = quote_vars["kwh_cost"]
        order.quote.machine_cost_per_hour = quote_vars["machine_cost_per_hour"]
        order.quote.labor_cost = result.labor_cost
        order.quote.labor_cost_per_hour = result.labor_cost_per_hour
        order.quote.labor_time_minutes = result.labor_time_minutes
        if "profit_multiplier" in quote_vars and quote_vars["profit_multiplier"] is not None:
            mult = Decimal(str(quote_vars["profit_multiplier"]))
            order.quote.profit_margin_pct = (mult - Decimal(1)) * Decimal(100)
        else:
            order.quote.profit_margin_pct = quote_vars["profit_margin_pct"]
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return order, result


def confirm_quote(order_id: int, informed_price, changed_by: int) -> Order:
    """Registers the informed price and transitions NUEVO -> PRESUPUESTADO atomically."""
    errors: dict[str, str] = {}
    try:
        informed_price_dec = Decimal(str(informed_price))
    except Exception:
        raise InformedPriceValidationError({"informed_price": "informed_price must be a valid number"}) from None
    if not informed_price_dec.is_finite():
        raise InformedPriceValidationError({"informed_price": "informed_price must be a valid number"})

    if informed_price_dec <= 0:
        errors["informed_price"] = "informed_price must be greater than 0"
    elif informed_price_dec > DECIMAL_10_2_MAX:
        errors["informed_price"] = f"informed_price exceeds allowed precision/range (max {DECIMAL_10_2_MAX})"
    elif has_sub_cent_precision(informed_price_dec):
        errors["informed_price"] = "informed_price must have at most 2 decimal places"
    if errors:
        raise InformedPriceValidationError(errors)

    order = get_order(order_id)
    if order.status == OrderStatus.CANCELADO.value:
        raise InvalidOrderStateError(f"Cannot confirm quote for order {order_id} in CANCELADO status")
    if order.quote is None:
        raise InvalidOrderStateError(f"Order {order_id} has no calculated quote to confirm")

    try:
        order.quote.informed_price = informed_price_dec
        order.quote.quoted_at = _utcnow()
        if order.status == OrderStatus.NUEVO.value:
            order.status = OrderStatus.PRESUPUESTADO.value
            db.session.add(
                OrderStatusHistory(
                    order_id=order.id,
                    from_status=OrderStatus.NUEVO.value,
                    to_status=OrderStatus.PRESUPUESTADO.value,
                    changed_by=changed_by,
                )
            )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return order


def _system_income_category(order_id: int, code: str) -> CashIncomeCategory:
    category = CashIncomeCategory.query.filter_by(code=code, is_system=True, is_active=True).first()
    if category is None:
        raise InvalidOrderStateError(f"Order {order_id}: cash category '{code}' unavailable")
    return category


def transition_order(
    order_id: int,
    target_status: str,
    changed_by: int,
    deposit_amount=None,
    collect_balance: bool = False,
    final_payment_amount=None,
) -> Order:
    """Advances an order one step through the lifecycle state machine, atomically:
    optimistic-guarded status UPDATE + OrderStatusHistory row (+ a CashMovement row when
    the transition is `-> APROBADO` and a deposit_amount was given, or when `-> ENTREGADO`
    and collect_balance is requested)."""
    errors: dict[str, str] = {}
    deposit_dec = None
    if deposit_amount is not None:
        try:
            deposit_dec = Decimal(str(deposit_amount))
        except Exception:
            raise DepositValidationError({"deposit_amount": "deposit_amount must be a valid number"}) from None
        if not deposit_dec.is_finite():
            raise DepositValidationError({"deposit_amount": "deposit_amount must be a valid number"})

        if target_status != OrderStatus.APROBADO.value:
            errors["deposit_amount"] = "deposit_amount is only accepted on the approve transition"
        elif deposit_dec < 0:
            errors["deposit_amount"] = "deposit_amount must be zero or a positive value"
        elif deposit_dec > DECIMAL_10_2_MAX:
            errors["deposit_amount"] = f"deposit_amount exceeds allowed precision/range (max {DECIMAL_10_2_MAX})"
        elif has_sub_cent_precision(deposit_dec):
            errors["deposit_amount"] = "deposit_amount must have at most 2 decimal places"
        if errors:
            raise DepositValidationError(errors)

    order = get_order(order_id)
    previous_status = order.status
    if not is_valid_transition(previous_status, target_status):
        raise InvalidOrderStateError(
            f"Order {order_id}: invalid transition {previous_status} -> {target_status}"
        )

    payment_dec = None
    if target_status == OrderStatus.ENTREGADO.value and collect_balance:
        pending_dec = pending_balance(order)
        if final_payment_amount is None:
            payment_dec = pending_dec
        else:
            invalid_number = {"final_payment_amount": "final_payment_amount must be a valid number"}
            try:
                payment_dec = Decimal(str(final_payment_amount))
            except Exception:
                raise DepositValidationError(invalid_number) from None
            if not payment_dec.is_finite():
                raise DepositValidationError(invalid_number)

            if payment_dec <= 0:
                errors["final_payment_amount"] = "final_payment_amount must be greater than 0"
            elif payment_dec > DECIMAL_10_2_MAX:
                errors["final_payment_amount"] = (
                    f"final_payment_amount exceeds allowed precision/range (max {DECIMAL_10_2_MAX})"
                )
            elif has_sub_cent_precision(payment_dec):
                errors["final_payment_amount"] = "final_payment_amount must have at most 2 decimal places"
            elif payment_dec > pending_dec:
                errors["final_payment_amount"] = (
                    f"final_payment_amount ({payment_dec}) exceeds pending balance ({pending_dec})"
                )
            if errors:
                raise DepositValidationError(errors)

    deposit_category = None
    if target_status == OrderStatus.APROBADO.value and deposit_dec is not None and deposit_dec > 0:
        deposit_category = _system_income_category(order_id, "seña")
    payment_category = None
    if target_status == OrderStatus.ENTREGADO.value and collect_balance and payment_dec is not None and payment_dec > 0:
        payment_category = _system_income_category(order_id, "saldo_pedido")

    try:
        # NOTE: this Core UPDATE (synchronize_session="evaluate" by default) mutates
        # order.status in-memory as soon as it executes — `previous_status` above MUST be
        # captured before this call, not read from `order.status` afterward.
        result = db.session.execute(
            db.update(Order)
            .where(Order.id == order_id, Order.status == previous_status)
            .values(status=target_status)
        )
        if result.rowcount == 0:
            # Lost a race with another concurrent transition — same error as an invalid
            # transition (the source status is no longer what we validated against).
            db.session.rollback()
            raise InvalidOrderStateError(
                f"Order {order_id}: invalid transition {previous_status} -> {target_status}"
            )

        db.session.add(
            OrderStatusHistory(
                order_id=order.id,
                from_status=previous_status,
                to_status=target_status,
                changed_by=changed_by,
            )
        )

        if deposit_category is not None:
            add_movement(
                type=CashMovementType.INGRESO.value,
                amount=deposit_dec,
                category_id=deposit_category.id,
                description=f"Seña inicial pedido #{order.id}",
                order_id=order.id,
                user_id=changed_by,
            )

        if payment_category is not None:
            add_movement(
                type=CashMovementType.INGRESO.value,
                amount=payment_dec,
                category_id=payment_category.id,
                description=f"Cobro saldo entrega pedido #{order.id}",
                order_id=order.id,
                user_id=changed_by,
            )

        db.session.commit()
    except InvalidOrderStateError:
        raise
    except Exception:
        db.session.rollback()
        raise

    db.session.refresh(order)
    return order


def get_order_history(order_id: int) -> Order:
    """Returns the order with its status/history eager-loaded (status_history relationship
    is `lazy="selectin"`, already ordered chronologically by changed_at)."""
    return get_order(order_id)


def delete_order(order_id: int, deleted_by: int | None = None) -> bool:
    """Permanently deletes an order, cascading to items, quotes, and status history.
    Any cash movements linked to this order have their order_id set to NULL to preserve physical cashbook balance.
    The deletion is recorded in the audit log (who, which order, status, linked cash movements)."""
    order = db.session.get(Order, order_id)
    if order is None:
        raise OrderNotFoundError(f"Order {order_id} not found")

    status = order.status
    linked_movements = CashMovement.query.filter_by(order_id=order.id).count()

    try:
        # Disassociate cash movements (preserving financial integrity according to ON DELETE SET NULL)
        CashMovement.query.filter_by(order_id=order.id).update({"order_id": None})
        db.session.delete(order)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    audit_logger.info(
        "order_deleted order_id=%s user_id=%s status=%s linked_cash_movements=%s",
        order_id,
        deleted_by,
        status,
        linked_movements,
    )
    return True

