from datetime import datetime, timezone
from enum import Enum

from app.extensions import db


class MaterialType(str, Enum):
    PLA = "PLA"
    PETG = "PETG"
    ABS = "ABS"
    TPU = "TPU"
    OTRO = "otro"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Material(db.Model):
    __tablename__ = "materials"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    brand = db.Column(db.String(80), nullable=False)
    type = db.Column(db.String(10), nullable=False)
    color = db.Column(db.String(60), nullable=False)
    cost_per_kg = db.Column(db.Numeric(10, 2), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=_utcnow)

    __table_args__ = (db.CheckConstraint("cost_per_kg >= 0", name="chk_materials_cost_per_kg"),)
