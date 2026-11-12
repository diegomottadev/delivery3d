from datetime import datetime, timezone

from app.extensions import db


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Printer(db.Model):
    """Normalized Printer entity (1FN, 2FN, 3FN, 4FN).
    Stores machine hardware parameters: name, power consumption in watts,
    and hourly amortization / wear cost."""

    __tablename__ = "printers"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    model = db.Column(db.String(100), nullable=True)
    power_watts = db.Column(db.Numeric(8, 2), nullable=False)
    cost_per_hour = db.Column(db.Numeric(10, 2), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=_utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        db.CheckConstraint("power_watts > 0", name="chk_printers_power_watts"),
        db.CheckConstraint("cost_per_hour >= 0", name="chk_printers_cost_per_hour"),
        db.Index("ix_printers_is_active", "is_active"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "model": self.model,
            "power_watts": float(self.power_watts) if self.power_watts is not None else 0.0,
            "cost_per_hour": float(self.cost_per_hour) if self.cost_per_hour is not None else 0.0,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
