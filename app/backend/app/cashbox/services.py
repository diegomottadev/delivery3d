from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_

from app.cashbox.models import (
    CashExpenseCategory,
    CashIncomeCategory,
    CashMovement,
    CashMovementType,
)
from app.extensions import db
from app.cashbox.balance import informed_price, pending_balance, pending_from, total_paid
from app.money import DECIMAL_10_2_MAX, has_sub_cent_precision
from app.orders.models import Order
from app.settings.models import WorkshopSettings


class CashboxValidationError(Exception):
    def __init__(self, errors: dict[str, str]):
        self.errors = errors
        super().__init__(str(errors))


class OrderBalanceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


# ---------------------------------------------------------------------------
# Category Services (1NF - 4NF/BCNF Normalization)
# ---------------------------------------------------------------------------


def list_income_categories(active_only: bool = True) -> list[CashIncomeCategory]:
    query = CashIncomeCategory.query
    if active_only:
        query = query.filter_by(is_active=True)
    return query.order_by(CashIncomeCategory.id.asc()).all()


def create_income_category(
    code: str,
    name: str,
    description: str | None = None,
) -> CashIncomeCategory:
    errors: dict[str, str] = {}
    code_str = str(code).strip().lower() if code else ""
    name_str = str(name).strip() if name else ""
    desc_str = str(description).strip() if description else None

    if not code_str:
        errors["code"] = "El código de categoría es requerido"
    elif len(code_str) > 50:
        errors["code"] = "El código no puede exceder los 50 caracteres"

    if not name_str:
        errors["name"] = "El nombre de categoría es requerido"
    elif len(name_str) > 100:
        errors["name"] = "El nombre no puede exceder los 100 caracteres"

    if desc_str and len(desc_str) > 255:
        errors["description"] = "La descripción no puede exceder los 255 caracteres"

    if not errors and CashIncomeCategory.query.filter_by(code=code_str).first():
        errors["code"] = f"Ya existe una categoría de ingreso con el código '{code_str}'"

    if errors:
        raise CashboxValidationError(errors)

    category = CashIncomeCategory(
        code=code_str,
        name=name_str,
        description=desc_str,
        is_system=False,
        is_active=True,
    )
    db.session.add(category)
    db.session.commit()
    return category


def update_income_category(
    category_id: int,
    name: str | None = None,
    description: str | None = None,
    is_active: bool | None = None,
) -> CashIncomeCategory:
    category = db.session.get(CashIncomeCategory, category_id)
    if not category:
        raise CashboxValidationError({"id": f"Categoría de ingreso #{category_id} no encontrada"})

    errors: dict[str, str] = {}
    if name is not None:
        name_str = str(name).strip()
        if not name_str:
            errors["name"] = "El nombre de categoría no puede estar vacío"
        elif len(name_str) > 100:
            errors["name"] = "El nombre no puede exceder los 100 caracteres"
        else:
            category.name = name_str

    if description is not None:
        desc_str = str(description).strip() if description else None
        if desc_str and len(desc_str) > 255:
            errors["description"] = "La descripción no puede exceder los 255 caracteres"
        else:
            category.description = desc_str

    if is_active is not None:
        if category.is_system and not is_active:
            errors["is_active"] = "No se pueden desactivar categorías del sistema"
        else:
            category.is_active = bool(is_active)

    if errors:
        raise CashboxValidationError(errors)

    db.session.commit()
    return category


def list_expense_categories(active_only: bool = True) -> list[CashExpenseCategory]:
    query = CashExpenseCategory.query
    if active_only:
        query = query.filter_by(is_active=True)
    return query.order_by(CashExpenseCategory.id.asc()).all()


def create_expense_category(
    code: str,
    name: str,
    description: str | None = None,
) -> CashExpenseCategory:
    errors: dict[str, str] = {}
    code_str = str(code).strip().lower() if code else ""
    name_str = str(name).strip() if name else ""
    desc_str = str(description).strip() if description else None

    if not code_str:
        errors["code"] = "El código de categoría es requerido"
    elif len(code_str) > 50:
        errors["code"] = "El código no puede exceder los 50 caracteres"

    if not name_str:
        errors["name"] = "El nombre de categoría es requerido"
    elif len(name_str) > 100:
        errors["name"] = "El nombre no puede exceder los 100 caracteres"

    if desc_str and len(desc_str) > 255:
        errors["description"] = "La descripción no puede exceder los 255 caracteres"

    if not errors and CashExpenseCategory.query.filter_by(code=code_str).first():
        errors["code"] = f"Ya existe una categoría de egreso con el código '{code_str}'"

    if errors:
        raise CashboxValidationError(errors)

    category = CashExpenseCategory(
        code=code_str,
        name=name_str,
        description=desc_str,
        is_system=False,
        is_active=True,
    )
    db.session.add(category)
    db.session.commit()
    return category


def update_expense_category(
    category_id: int,
    name: str | None = None,
    description: str | None = None,
    is_active: bool | None = None,
) -> CashExpenseCategory:
    category = db.session.get(CashExpenseCategory, category_id)
    if not category:
        raise CashboxValidationError({"id": f"Categoría de egreso #{category_id} no encontrada"})

    errors: dict[str, str] = {}
    if name is not None:
        name_str = str(name).strip()
        if not name_str:
            errors["name"] = "El nombre de categoría no puede estar vacío"
        elif len(name_str) > 100:
            errors["name"] = "El nombre no puede exceder los 100 caracteres"
        else:
            category.name = name_str

    if description is not None:
        desc_str = str(description).strip() if description else None
        if desc_str and len(desc_str) > 255:
            errors["description"] = "La descripción no puede exceder los 255 caracteres"
        else:
            category.description = desc_str

    if is_active is not None:
        if category.is_system and not is_active:
            errors["is_active"] = "No se pueden desactivar categorías del sistema"
        else:
            category.is_active = bool(is_active)

    if errors:
        raise CashboxValidationError(errors)

    db.session.commit()
    return category


# ---------------------------------------------------------------------------
# Cash Movements Services
# ---------------------------------------------------------------------------


def add_movement(
    *,
    type: str,
    amount: Any,
    category: str | None = None,
    description: str | None = None,
    order_id: int | None = None,
    user_id: int = 1,
    category_id: int | None = None,
) -> CashMovement:
    """Validates and db.session.add()s a cash movement. Does NOT commit: the caller owns the transaction."""
    errors: dict[str, str] = {}

    type_str = str(type).strip().lower() if type else ""
    if type_str not in (CashMovementType.INGRESO.value, CashMovementType.EGRESO.value):
        errors["type"] = f"El tipo debe ser '{CashMovementType.INGRESO.value}' o '{CashMovementType.EGRESO.value}'"

    amount_dec = None
    try:
        amount_dec = Decimal(str(amount))
    except Exception:
        errors["amount"] = "El monto debe ser un número válido"
    if amount_dec is not None and not amount_dec.is_finite():
        errors["amount"] = "El monto debe ser un número válido"
        amount_dec = None

    if amount_dec is not None:
        if amount_dec <= 0:
            errors["amount"] = "El monto debe ser mayor a 0"
        elif amount_dec > DECIMAL_10_2_MAX:
            errors["amount"] = f"El monto excede el valor máximo permitido ({DECIMAL_10_2_MAX})"
        elif has_sub_cent_precision(amount_dec):
            errors["amount"] = "El monto no puede tener más de 2 decimales"

    category_str = str(category).strip() if category else ""
    income_cat_id = None
    expense_cat_id = None

    if not category_str and category_id is None:
        errors["category"] = "La categoría es requerida"
    elif type_str == CashMovementType.INGRESO.value:
        income_cat = None
        if category_id is not None:
            income_cat = db.session.get(CashIncomeCategory, category_id)
        elif category_str:
            income_cat = CashIncomeCategory.query.filter(
                or_(
                    CashIncomeCategory.code == category_str,
                    CashIncomeCategory.name == category_str,
                )
            ).first()

        if not income_cat:
            errors["category"] = f"La categoría de ingreso '{category_str or category_id}' no es válida"
        elif not income_cat.is_active:
            errors["category"] = f"La categoría de ingreso '{income_cat.name}' está inactiva"
        else:
            income_cat_id = income_cat.id
            category_str = income_cat.code
    elif type_str == CashMovementType.EGRESO.value:
        expense_cat = None
        if category_id is not None:
            expense_cat = db.session.get(CashExpenseCategory, category_id)
        elif category_str:
            expense_cat = CashExpenseCategory.query.filter(
                or_(
                    CashExpenseCategory.code == category_str,
                    CashExpenseCategory.name == category_str,
                )
            ).first()

        if not expense_cat:
            errors["category"] = f"La categoría de egreso '{category_str or category_id}' no es válida"
        elif not expense_cat.is_active:
            errors["category"] = f"La categoría de egreso '{expense_cat.name}' está inactiva"
        else:
            expense_cat_id = expense_cat.id
            category_str = expense_cat.code

    if category_str and len(category_str) > 60:
        errors["category"] = "La categoría no puede exceder los 60 caracteres"

    desc_str = str(description).strip() if description else None
    if desc_str and len(desc_str) > 255:
        errors["description"] = "La descripción no puede exceder los 255 caracteres"

    if order_id is not None:
        order = db.session.get(Order, order_id)
        if not order:
            errors["order_id"] = f"El pedido #{order_id} no existe"

    if errors:
        raise CashboxValidationError(errors)

    movement = CashMovement(
        type=type_str,
        amount=amount_dec,
        category=category_str,
        description=desc_str,
        order_id=order_id,
        user_id=user_id,
        income_category_id=income_cat_id,
        expense_category_id=expense_cat_id,
    )
    db.session.add(movement)
    return movement


def create_movement(
    type: str,
    amount: Any,
    category: str | None = None,
    description: str | None = None,
    order_id: int | None = None,
    user_id: int = 1,
    category_id: int | None = None,
) -> CashMovement:
    """Creates and persists a new cash movement with strict financial validation and catalog linking."""
    movement = add_movement(
        type=type,
        amount=amount,
        category=category,
        description=description,
        order_id=order_id,
        user_id=user_id,
        category_id=category_id,
    )
    db.session.commit()
    return movement


def get_cash_summary() -> dict:
    """Computes dynamic cashbox balance on-read (3FN compliant).
    SUM(ingresos) - SUM(egresos) calculated in real time without storing redundant balances."""
    ingresos = (
        db.session.query(func.coalesce(func.sum(CashMovement.amount), 0))
        .filter(CashMovement.type == CashMovementType.INGRESO.value)
        .scalar()
    )
    egresos = (
        db.session.query(func.coalesce(func.sum(CashMovement.amount), 0))
        .filter(CashMovement.type == CashMovementType.EGRESO.value)
        .scalar()
    )

    ingresos_dec = Decimal(str(ingresos))
    egresos_dec = Decimal(str(egresos))
    balance_dec = ingresos_dec - egresos_dec
    movements_count = db.session.query(func.count(CashMovement.id)).scalar() or 0

    settings = WorkshopSettings.query.first()
    currency_code = settings.currency_code if settings and settings.currency_code else "ARS"
    currency_symbol = settings.currency_symbol if settings and settings.currency_symbol else "AR$"

    return {
        "total_ingresos": float(ingresos_dec),
        "total_egresos": float(egresos_dec),
        "current_balance": float(balance_dec),
        "currency_code": currency_code,
        "currency_symbol": currency_symbol,
        "movements_count": movements_count,
    }


def list_movements(
    limit: int | None = None,
    offset: int | None = None,
    type_: str | None = None,
    category: str | None = None,
    order_id: int | None = None,
) -> list[CashMovement]:
    """Returns cash movements chronologically (newest first) with optional filters."""
    query = CashMovement.query

    if type_:
        query = query.filter(CashMovement.type == type_.strip().lower())
    if category:
        query = query.filter(CashMovement.category == category.strip())
    if order_id:
        query = query.filter(CashMovement.order_id == order_id)

    query = query.order_by(CashMovement.created_at.desc(), CashMovement.id.desc())

    if offset is not None:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)

    return query.all()


def get_order_balance_info(order_id: int) -> dict:
    """Calculates order payment status: quoted price, total paid, and pending balance."""
    order = db.session.get(Order, order_id)
    if not order:
        raise OrderBalanceError(f"El pedido #{order_id} no existe", status_code=404)

    informed_price_dec = informed_price(order)
    total_paid_dec = total_paid(order.id)
    pending_balance_dec = pending_from(informed_price_dec, total_paid_dec)

    settings = WorkshopSettings.query.first()
    currency_code = settings.currency_code if settings and settings.currency_code else "ARS"
    currency_symbol = settings.currency_symbol if settings and settings.currency_symbol else "AR$"

    return {
        "order_id": order.id,
        "client_name": order.client.name if order.client else "",
        "status": order.status,
        "informed_price": float(informed_price_dec),
        "total_paid": float(total_paid_dec),
        "pending_balance": float(pending_balance_dec),
        "currency_code": currency_code,
        "currency_symbol": currency_symbol,
    }


def collect_order_balance(
    order_id: int,
    user_id: int,
    amount: Any = None,
    description: str | None = None,
) -> CashMovement:
    """Collects pending balance for an order and logs an 'ingreso' cash movement."""
    order = db.session.get(Order, order_id)
    if not order:
        raise OrderBalanceError(f"El pedido #{order_id} no existe", status_code=404)
    pending_balance_dec = pending_balance(order)

    if pending_balance_dec <= 0:
        raise OrderBalanceError("El pedido no tiene saldo pendiente por cobrar", status_code=422)

    if amount is None:
        collect_amount_dec = pending_balance_dec
    else:
        try:
            collect_amount_dec = Decimal(str(amount))
        except Exception:
            raise CashboxValidationError({"amount": "El monto debe ser un número válido"}) from None
        if not collect_amount_dec.is_finite():
            raise CashboxValidationError({"amount": "El monto debe ser un número válido"})

        if collect_amount_dec <= 0:
            raise CashboxValidationError({"amount": "El monto a cobrar debe ser mayor a 0"})
        if collect_amount_dec > pending_balance_dec:
            raise CashboxValidationError(
                {"amount": f"El monto a cobrar ({collect_amount_dec}) excede el saldo pendiente ({pending_balance_dec})"}
            )
        if has_sub_cent_precision(collect_amount_dec):
            raise CashboxValidationError({"amount": "El monto no puede tener más de 2 decimales"})

    desc = description or f"Cobro saldo pedido #{order_id}"
    return create_movement(
        type=CashMovementType.INGRESO.value,
        amount=collect_amount_dec,
        category="saldo_pedido",
        description=desc,
        order_id=order_id,
        user_id=user_id,
    )
