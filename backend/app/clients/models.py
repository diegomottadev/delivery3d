from datetime import datetime, timezone
from enum import Enum

from app.extensions import db


class ClientOrigin(str, Enum):
    WHATSAPP = "whatsapp"
    INSTAGRAM_DM = "instagram_dm"
    OTRO = "otro"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Client(db.Model):
    __tablename__ = "clients"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(120), nullable=False)
    origin = db.Column(db.String(20), nullable=False)
    phone = db.Column(db.String(40), nullable=True)
    instagram_username = db.Column(db.String(80), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=_utcnow)

    __table_args__ = (db.Index("ix_clients_name", "name"),)
