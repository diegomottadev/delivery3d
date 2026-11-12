from datetime import datetime, timezone

from app.extensions import db


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WorkshopSettings(db.Model):
    """Normalized Workshop Settings / Configuration entity (1FN, 2FN, 3FN, 4FN).
    Stores global default parameters for quote calculation in the workshop."""

    __tablename__ = "workshop_settings"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    kwh_cost = db.Column(db.Numeric(10, 2), nullable=False, default=278.00)
    waste_purge_pct = db.Column(db.Numeric(5, 2), nullable=False, default=10.00)
    labor_cost = db.Column(db.Numeric(10, 2), nullable=False, default=1500.00)
    labor_cost_per_hour = db.Column(db.Numeric(10, 2), nullable=False, default=650.00)
    default_labor_time_minutes = db.Column(db.Integer, nullable=False, default=15)
    profit_multiplier = db.Column(db.Numeric(4, 2), nullable=False, default=2.00)
    currency_code = db.Column(db.String(3), nullable=False, default="ARS")
    currency_symbol = db.Column(db.String(10), nullable=False, default="AR$")
    default_printer_id = db.Column(
        db.Integer, db.ForeignKey("printers.id", ondelete="SET NULL"), nullable=True
    )
    updated_at = db.Column(db.DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    default_printer = db.relationship("Printer", foreign_keys=[default_printer_id])

    __table_args__ = (
        db.CheckConstraint("kwh_cost >= 0", name="chk_workshop_settings_kwh"),
        db.CheckConstraint("waste_purge_pct >= 0", name="chk_workshop_settings_waste"),
        db.CheckConstraint("labor_cost >= 0", name="chk_workshop_settings_labor"),
        db.CheckConstraint("labor_cost_per_hour >= 0", name="chk_workshop_settings_labor_hour"),
        db.CheckConstraint("default_labor_time_minutes >= 0", name="chk_workshop_settings_labor_time"),
        db.CheckConstraint("profit_multiplier >= 1", name="chk_workshop_settings_multiplier"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "currency_code": self.currency_code or "ARS",
            "currency_symbol": self.currency_symbol or "AR$",
            "kwh_cost": float(self.kwh_cost) if self.kwh_cost is not None else 278.00,
            "waste_purge_pct": float(self.waste_purge_pct) if self.waste_purge_pct is not None else 10.00,
            "labor_cost": float(self.labor_cost) if self.labor_cost is not None else 1500.00,
            "labor_cost_per_hour": float(self.labor_cost_per_hour) if self.labor_cost_per_hour is not None else 650.00,
            "default_labor_time_minutes": self.default_labor_time_minutes if self.default_labor_time_minutes is not None else 15,
            "profit_multiplier": float(self.profit_multiplier) if self.profit_multiplier is not None else 2.00,
            "default_printer_id": self.default_printer_id,
            "default_printer": self.default_printer.to_dict() if self.default_printer else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
