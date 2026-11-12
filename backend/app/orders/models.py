from datetime import datetime, timezone
from enum import Enum

from app.extensions import db


class OrderStatus(str, Enum):
    NUEVO = "nuevo"
    PRESUPUESTADO = "presupuestado"
    APROBADO = "aprobado"
    IMPRIMIENDO = "imprimiendo"
    LISTO = "listo"
    ENTREGADO = "entregado"
    CANCELADO = "cancelado"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(20), nullable=False, default=OrderStatus.NUEVO.value)
    created_at = db.Column(db.DateTime, nullable=False, default=_utcnow)

    client = db.relationship("Client")
    items = db.relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )
    quote = db.relationship(
        "OrderQuote", back_populates="order", uselist=False, cascade="all, delete-orphan"
    )
    status_history = db.relationship(
        "OrderStatusHistory",
        back_populates="order",
        order_by="OrderStatusHistory.changed_at",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (db.Index("ix_orders_status_created_at", "status", "created_at"),)


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    material_id = db.Column(db.Integer, db.ForeignKey("materials.id"), nullable=True)
    filament_id = db.Column(db.Integer, db.ForeignKey("filaments.id"), nullable=True)
    piece_description = db.Column(db.Text, nullable=False)
    reference_url = db.Column(db.String(500), nullable=True)
    weight_g = db.Column(db.Numeric(10, 3), nullable=False)
    print_time_minutes = db.Column(db.Integer, nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    material_cost_per_kg = db.Column(db.Numeric(10, 2), nullable=True)

    order = db.relationship("Order", back_populates="items")
    material = db.relationship("Material")
    filament = db.relationship("Filament")

    __table_args__ = (
        db.CheckConstraint("weight_g > 0", name="chk_order_items_weight"),
        db.CheckConstraint("print_time_minutes > 0", name="chk_order_items_time"),
        db.CheckConstraint("quantity > 0", name="chk_order_items_qty"),
        db.CheckConstraint("material_cost_per_kg IS NULL OR material_cost_per_kg >= 0", name="chk_order_items_mat_cost"),
        db.CheckConstraint("material_id IS NOT NULL OR filament_id IS NOT NULL", name="chk_order_items_mat_or_fil"),
        db.Index("ix_order_items_order_id", "order_id"),
        db.Index("ix_order_items_filament_id", "filament_id"),
    )


class OrderQuote(db.Model):
    """3FN: only workshop cost PARAMETERS + the operator's final informed price are stored.
    production_cost / suggested_sale_price are NOT columns here — they are derived from
    OrderItem (+ Material.cost_per_kg) and computed on read via pricing.compute_quote."""

    __tablename__ = "order_quotes"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False, unique=True)
    printer_id = db.Column(db.Integer, db.ForeignKey("printers.id", ondelete="SET NULL"), nullable=True)
    kwh_cost = db.Column(db.Numeric(8, 2), nullable=False)
    machine_power_watts = db.Column(db.Numeric(6, 2), nullable=False)
    machine_cost_per_hour = db.Column(db.Numeric(8, 2), nullable=False)
    waste_purge_pct = db.Column(db.Numeric(5, 2), nullable=False)
    profit_margin_pct = db.Column(db.Numeric(5, 2), nullable=False)
    labor_cost = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    labor_cost_per_hour = db.Column(db.Numeric(10, 2), nullable=True, default=650.00)
    labor_time_minutes = db.Column(db.Integer, nullable=True, default=15)
    informed_price = db.Column(db.Numeric(10, 2), nullable=True)
    quoted_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=_utcnow)

    order = db.relationship("Order", back_populates="quote")
    printer = db.relationship("Printer", foreign_keys=[printer_id])

    __table_args__ = (
        db.CheckConstraint(
            "informed_price IS NULL OR informed_price > 0", name="chk_order_quotes_informed_price"
        ),
        db.CheckConstraint(
            "waste_purge_pct >= 0 AND profit_margin_pct >= 0 AND labor_cost >= 0",
            name="chk_order_quotes_pct_labor",
        ),
        db.CheckConstraint(
            "labor_cost_per_hour IS NULL OR labor_cost_per_hour >= 0",
            name="chk_order_quotes_labor_hour",
        ),
        db.CheckConstraint(
            "labor_time_minutes IS NULL OR labor_time_minutes >= 0",
            name="chk_order_quotes_labor_time",
        ),
    )


class OrderStatusHistory(db.Model):
    __tablename__ = "order_status_history"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    from_status = db.Column(db.String(20), nullable=True)
    to_status = db.Column(db.String(20), nullable=False)
    changed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    changed_at = db.Column(db.DateTime, nullable=False, default=_utcnow)

    order = db.relationship("Order", back_populates="status_history")

    __table_args__ = (db.Index("ix_osh_order_id_changed_at", "order_id", "changed_at"),)
