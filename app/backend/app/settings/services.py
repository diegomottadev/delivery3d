from decimal import Decimal

from app.extensions import db
from app.printers.models import Printer
from app.settings.models import WorkshopSettings


def get_or_create_settings() -> WorkshopSettings:
    settings = WorkshopSettings.query.first()
    if not settings:
        # Check if default printer exists
        default_printer = Printer.query.first()
        settings = WorkshopSettings(
            id=1,
            kwh_cost=Decimal("278.00"),
            waste_purge_pct=Decimal("10.00"),
            labor_cost=Decimal("1500.00"),
            profit_multiplier=Decimal("2.00"),
            currency_code="ARS",
            currency_symbol="AR$",
            default_printer_id=default_printer.id if default_printer else None,
        )
        db.session.add(settings)
        db.session.commit()
    return settings
