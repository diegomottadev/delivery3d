"""Cashbox domain models conforming to 1NF-4NF/BCNF normalization.
Catalog tables for income categories and expense categories, linked to cash movements."""

from datetime import datetime, timezone
from enum import Enum

from app.extensions import db


class CashMovementType(str, Enum):
    INGRESO = "ingreso"
    EGRESO = "egreso"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CashIncomeCategory(db.Model):
    __tablename__ = "cash_income_categories"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    code = db.Column(db.String(50), nullable=False, unique=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    is_system = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=_utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "is_system": self.is_system,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class CashExpenseCategory(db.Model):
    __tablename__ = "cash_expense_categories"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    code = db.Column(db.String(50), nullable=False, unique=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    is_system = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=_utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "is_system": self.is_system,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class CashMovement(db.Model):
    __tablename__ = "cash_movements"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    type = db.Column(db.String(10), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    category = db.Column(db.String(60), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    income_category_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "cash_income_categories.id",
            name="fk_cash_movements_income_cat",
            ondelete="RESTRICT",
            onupdate="CASCADE",
        ),
        nullable=True,
    )
    expense_category_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "cash_expense_categories.id",
            name="fk_cash_movements_expense_cat",
            ondelete="RESTRICT",
            onupdate="CASCADE",
        ),
        nullable=True,
    )
    created_at = db.Column(db.DateTime, nullable=False, default=_utcnow)

    order = db.relationship("Order")
    user = db.relationship("User")
    income_category = db.relationship("CashIncomeCategory", backref="movements")
    expense_category = db.relationship("CashExpenseCategory", backref="movements")

    __table_args__ = (
        db.CheckConstraint("amount > 0", name="chk_cash_movements_amount"),
        db.Index("ix_cash_movements_order_id", "order_id"),
        db.Index("ix_cash_movements_created_at", "created_at"),
        db.Index("ix_cash_movements_income_category_id", "income_category_id"),
        db.Index("ix_cash_movements_expense_category_id", "expense_category_id"),
    )

    def to_dict(self) -> dict:
        category_name = None
        if self.type == CashMovementType.INGRESO.value and self.income_category:
            category_name = self.income_category.name
        elif self.type == CashMovementType.EGRESO.value and self.expense_category:
            category_name = self.expense_category.name

        return {
            "id": self.id,
            "type": self.type,
            "amount": float(self.amount) if self.amount is not None else 0.0,
            "category": self.category,
            "category_name": category_name or self.category,
            "description": self.description,
            "order_id": self.order_id,
            "user_id": self.user_id,
            "income_category_id": self.income_category_id,
            "expense_category_id": self.expense_category_id,
            "operator_username": self.user.username if self.user else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
