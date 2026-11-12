from flask import Blueprint, g, jsonify, request

from app.auth.security import login_required
from app.http import json_body
from app.orders.models import OrderStatus
from app.orders.pricing import PricingValidationError
from app.orders.schemas import ValidationError, serialize_order, serialize_order_history, validate_order_intake
from app.orders.services import (
    ClientNotFoundError,
    DepositValidationError,
    FilamentNotFoundError,
    InformedPriceValidationError,
    InvalidOrderStateError,
    MaterialNotFoundError,
    OrderNotFoundError,
    calculate_quote,
    confirm_quote,
    create_order,
    delete_order,
    get_order,
    get_order_history,
    get_order_pricing,
    list_orders,
    transition_order,
    update_order,
)

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")


@orders_bp.post("")
@login_required
def create_order_route():
    payload = json_body()
    try:
        cleaned = validate_order_intake(payload)
    except ValidationError as exc:
        return jsonify(errors=exc.errors), 422

    try:
        order = create_order(
            items=cleaned["items"],
            created_by=g.current_user_id,
            client_id=cleaned["client_id"],
            client=cleaned["client"],
        )
    except (ClientNotFoundError, MaterialNotFoundError, FilamentNotFoundError) as exc:
        return jsonify(error=str(exc)), 422

    return jsonify(serialize_order(order)), 201


@orders_bp.put("/<int:order_id>")
@login_required
def update_order_route(order_id: int):
    payload = json_body()
    try:
        cleaned = validate_order_intake(payload)
    except ValidationError as exc:
        return jsonify(errors=exc.errors), 422

    try:
        order = update_order(
            order_id=order_id,
            items=cleaned["items"],
            client_id=cleaned["client_id"],
            client=cleaned["client"],
        )
    except OrderNotFoundError:
        return jsonify(error="Order not found"), 404
    except (ClientNotFoundError, MaterialNotFoundError, FilamentNotFoundError) as exc:
        return jsonify(error=str(exc)), 422

    return jsonify(serialize_order(order, get_order_pricing(order))), 200


MAX_PAGE_SIZE = 500


def _pagination_args() -> tuple[int, int]:
    """?limit= (1..500, default 500) y ?offset= (>= 0, default 0). Lanza ValueError si son inválidos."""
    limit = int(request.args.get("limit", MAX_PAGE_SIZE))
    offset = int(request.args.get("offset", 0))
    if not 1 <= limit <= MAX_PAGE_SIZE or offset < 0:
        raise ValueError
    return limit, offset


@orders_bp.get("")
@login_required
def list_orders_route():
    try:
        limit, offset = _pagination_args()
    except ValueError:
        return jsonify(errors={"pagination": f"limit debe estar entre 1 y {MAX_PAGE_SIZE}; offset >= 0"}), 422

    orders, total = list_orders(limit=limit, offset=offset)
    resp = jsonify([serialize_order(o, get_order_pricing(o)) for o in orders])
    resp.headers["X-Total-Count"] = str(total)
    return resp, 200


@orders_bp.get("/<int:order_id>")
@login_required
def get_order_route(order_id: int):
    try:
        order = get_order(order_id)
    except OrderNotFoundError:
        return jsonify(error="Order not found"), 404
    return jsonify(serialize_order(order, get_order_pricing(order))), 200


@orders_bp.post("/<int:order_id>/quote")
@login_required
def calculate_quote_route(order_id: int):
    payload = json_body()
    quote_vars = payload.get("quote_vars", {})
    if not isinstance(quote_vars, dict):
        return jsonify(errors={"quote_vars": "quote_vars debe ser un objeto"}), 422

    try:
        order, result = calculate_quote(order_id, quote_vars)
    except OrderNotFoundError:
        return jsonify(error="Order not found"), 404
    except InvalidOrderStateError as exc:
        return jsonify(error=str(exc)), 409
    except PricingValidationError as exc:
        return jsonify(errors=exc.errors), 422

    return jsonify(serialize_order(order, result)), 200


@orders_bp.post("/<int:order_id>/quote/confirm")
@login_required
def confirm_quote_route(order_id: int):
    payload = json_body()
    informed_price = payload.get("informed_price")

    try:
        order = confirm_quote(order_id, informed_price, changed_by=g.current_user_id)
    except OrderNotFoundError:
        return jsonify(error="Order not found"), 404
    except InformedPriceValidationError as exc:
        return jsonify(errors=exc.errors), 422
    except InvalidOrderStateError as exc:
        return jsonify(error=str(exc)), 409

    return jsonify(serialize_order(order, get_order_pricing(order))), 200


def _transition_route(order_id: int, target_status: str, accept_deposit: bool = False):
    payload = json_body()
    deposit_amount = payload.get("deposit_amount")
    if not accept_deposit and deposit_amount is not None:
        return jsonify(errors={"deposit_amount": "deposit_amount is only accepted on the approve transition"}), 422

    try:
        order = transition_order(order_id, target_status, changed_by=g.current_user_id, deposit_amount=deposit_amount)
    except OrderNotFoundError:
        return jsonify(error="Order not found"), 404
    except DepositValidationError as exc:
        return jsonify(errors=exc.errors), 422
    except InvalidOrderStateError as exc:
        return jsonify(error=str(exc)), 409

    return jsonify(serialize_order(order, get_order_pricing(order))), 200


@orders_bp.post("/<int:order_id>/approve")
@login_required
def approve_order_route(order_id: int):
    return _transition_route(order_id, OrderStatus.APROBADO.value, accept_deposit=True)


@orders_bp.post("/<int:order_id>/start-printing")
@login_required
def start_printing_route(order_id: int):
    return _transition_route(order_id, OrderStatus.IMPRIMIENDO.value)


@orders_bp.post("/<int:order_id>/mark-ready")
@login_required
def mark_ready_route(order_id: int):
    return _transition_route(order_id, OrderStatus.LISTO.value)


@orders_bp.post("/<int:order_id>/deliver")
@login_required
def deliver_order_route(order_id: int):
    payload = json_body()
    collect_balance = bool(payload.get("collect_balance", False))
    final_payment_amount = payload.get("final_payment_amount")

    try:
        order = transition_order(
            order_id,
            OrderStatus.ENTREGADO.value,
            changed_by=g.current_user_id,
            collect_balance=collect_balance,
            final_payment_amount=final_payment_amount,
        )
    except OrderNotFoundError:
        return jsonify(error="Order not found"), 404
    except DepositValidationError as exc:
        return jsonify(errors=exc.errors), 422
    except InvalidOrderStateError as exc:
        return jsonify(error=str(exc)), 409

    return jsonify(serialize_order(order, get_order_pricing(order))), 200


@orders_bp.get("/<int:order_id>/history")
@login_required
def order_history_route(order_id: int):
    try:
        order = get_order_history(order_id)
    except OrderNotFoundError:
        return jsonify(error="Order not found"), 404
    return jsonify(serialize_order_history(order)), 200


@orders_bp.delete("/<int:order_id>")
@login_required
def delete_order_route(order_id: int):
    try:
        delete_order(order_id, deleted_by=g.current_user_id)
    except OrderNotFoundError:
        return jsonify(error="Order not found"), 404
    return jsonify(message=f"Pedido #{order_id} eliminado correctamente"), 200

