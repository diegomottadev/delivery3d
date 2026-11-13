from flask import Blueprint, g, jsonify, request

from app.http import json_body
from app.rbac.constants import Perm
from app.rbac.security import permission_required
from app.cashbox.services import (
    CashboxValidationError,
    OrderBalanceError,
    collect_order_balance,
    create_expense_category,
    create_income_category,
    create_movement,
    get_cash_summary,
    get_order_balance_info,
    list_expense_categories,
    list_income_categories,
    list_movements,
    update_expense_category,
    update_income_category,
)

cashbox_bp = Blueprint("cashbox", __name__, url_prefix="/api/cashbox")


# ---------------------------------------------------------------------------
# Categories Endpoints (Income & Expense)
# ---------------------------------------------------------------------------


@cashbox_bp.get("/categories/income")
@permission_required(Perm.CASH_CATEGORIES_READ)
def get_income_categories_route():
    all_flag = request.args.get("all", "false").lower() in ("true", "1")
    categories = list_income_categories(active_only=not all_flag)
    return jsonify([c.to_dict() for c in categories]), 200


@cashbox_bp.post("/categories/income")
@permission_required(Perm.CASH_CATEGORIES_CREATE)
def create_income_category_route():
    data = json_body()
    code = data.get("code")
    name = data.get("name")
    description = data.get("description")

    try:
        category = create_income_category(code=code, name=name, description=description)
        return jsonify(category.to_dict()), 201
    except CashboxValidationError as exc:
        return jsonify(errors=exc.errors), 422
    except Exception as exc:
        return jsonify(error=str(exc)), 500


@cashbox_bp.put("/categories/income/<int:cat_id>")
@permission_required(Perm.CASH_CATEGORIES_UPDATE)
def update_income_category_route(cat_id: int):
    data = json_body()
    name = data.get("name")
    description = data.get("description")
    is_active = data.get("is_active")

    try:
        category = update_income_category(
            category_id=cat_id,
            name=name,
            description=description,
            is_active=is_active,
        )
        return jsonify(category.to_dict()), 200
    except CashboxValidationError as exc:
        return jsonify(errors=exc.errors), 422
    except Exception as exc:
        return jsonify(error=str(exc)), 500


@cashbox_bp.get("/categories/expense")
@permission_required(Perm.CASH_CATEGORIES_READ)
def get_expense_categories_route():
    all_flag = request.args.get("all", "false").lower() in ("true", "1")
    categories = list_expense_categories(active_only=not all_flag)
    return jsonify([c.to_dict() for c in categories]), 200


@cashbox_bp.post("/categories/expense")
@permission_required(Perm.CASH_CATEGORIES_CREATE)
def create_expense_category_route():
    data = json_body()
    code = data.get("code")
    name = data.get("name")
    description = data.get("description")

    try:
        category = create_expense_category(code=code, name=name, description=description)
        return jsonify(category.to_dict()), 201
    except CashboxValidationError as exc:
        return jsonify(errors=exc.errors), 422
    except Exception as exc:
        return jsonify(error=str(exc)), 500


@cashbox_bp.put("/categories/expense/<int:cat_id>")
@permission_required(Perm.CASH_CATEGORIES_UPDATE)
def update_expense_category_route(cat_id: int):
    data = json_body()
    name = data.get("name")
    description = data.get("description")
    is_active = data.get("is_active")

    try:
        category = update_expense_category(
            category_id=cat_id,
            name=name,
            description=description,
            is_active=is_active,
        )
        return jsonify(category.to_dict()), 200
    except CashboxValidationError as exc:
        return jsonify(errors=exc.errors), 422
    except Exception as exc:
        return jsonify(error=str(exc)), 500


# ---------------------------------------------------------------------------
# Cash Movements Endpoints
# ---------------------------------------------------------------------------


@cashbox_bp.get("/summary")
@permission_required(Perm.CASH_MOVEMENTS_READ)
def get_summary_route():
    summary = get_cash_summary()
    return jsonify(summary), 200


@cashbox_bp.get("/movements")
@permission_required(Perm.CASH_MOVEMENTS_READ)
def list_movements_route():
    type_ = request.args.get("type")
    category = request.args.get("category")
    order_id = request.args.get("order_id", type=int)
    limit = request.args.get("limit", type=int)
    offset = request.args.get("offset", type=int)

    movements = list_movements(
        limit=limit,
        offset=offset,
        type_=type_,
        category=category,
        order_id=order_id,
    )
    return jsonify([m.to_dict() for m in movements]), 200


@cashbox_bp.post("/movements")
@permission_required(Perm.CASH_MOVEMENTS_CREATE)
def create_movement_route():
    data = json_body()
    type_ = data.get("type")
    amount = data.get("amount")
    category = data.get("category")
    category_id = data.get("category_id")
    description = data.get("description")
    order_id = data.get("order_id")

    try:
        movement = create_movement(
            type=type_,
            amount=amount,
            category=category,
            category_id=category_id,
            description=description,
            order_id=order_id,
            user_id=g.current_user_id,
        )
        return jsonify(movement.to_dict()), 201
    except CashboxValidationError as exc:
        return jsonify(errors=exc.errors), 422
    except Exception as exc:
        return jsonify(error=str(exc)), 500


@cashbox_bp.get("/orders/<int:order_id>/balance")
@permission_required(Perm.CASH_MOVEMENTS_READ)
def order_balance_route(order_id: int):
    try:
        info = get_order_balance_info(order_id)
        return jsonify(info), 200
    except OrderBalanceError as exc:
        return jsonify(error=exc.message), exc.status_code
    except Exception as exc:
        return jsonify(error=str(exc)), 500


@cashbox_bp.post("/orders/<int:order_id>/collect-balance")
@permission_required(Perm.CASH_MOVEMENTS_CREATE)
def collect_order_balance_route(order_id: int):
    data = json_body()
    amount = data.get("amount")
    description = data.get("description")

    try:
        movement = collect_order_balance(
            order_id=order_id,
            user_id=g.current_user_id,
            amount=amount,
            description=description,
        )
        return jsonify(movement.to_dict()), 201
    except OrderBalanceError as exc:
        return jsonify(error=exc.message), exc.status_code
    except CashboxValidationError as exc:
        return jsonify(errors=exc.errors), 422
    except Exception as exc:
        return jsonify(error=str(exc)), 500
