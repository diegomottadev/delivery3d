"""E3-6 opción B (rbac-access-control, etapa 4 — rojo; se implementa en etapa 5).

Decisión del usuario: "usa siempre los COSTOS y el margen del taller".
Si el actor NO tiene `settings:update` (y no es superusuario), `POST /api/orders/<id>/quote`
ignora del body kwh_cost, machine_power_watts, machine_cost_per_hour, profit_margin_pct,
profit_multiplier, waste_purge_pct, labor_cost y labor_cost_per_hour, y usa:
- kwh_cost                -> workshop_settings.kwh_cost
- profit_margin_pct       -> (workshop_settings.profit_multiplier - 1) * 100
- waste_purge_pct         -> workshop_settings.waste_purge_pct
- labor_cost_per_hour     -> workshop_settings.labor_cost_per_hour
- labor_cost              -> labor_cost_per_hour * labor_time_minutes / 60 (siempre modelo por hora)
- machine_power_watts     -> printers.power_watts      de la impresora elegida (printer_id),
- machine_cost_per_hour   -> printers.cost_per_hour    o de la impresora por defecto del taller.
SÍ se aceptan del body: `printer_id` (si no lo manda, queda la impresora por defecto; sin
impresora elegida ni por defecto -> 422 con errors.printer_id), `labor_time_minutes` (esfuerzo
del pedido; si no lo manda -> workshop_settings.default_labor_time_minutes) e `informed_price`
en quote/confirm. Con `settings:update`, el body se respeta completo.
"""

from decimal import Decimal

import pytest

from app.extensions import db
from app.printers.models import Printer
from app.rbac.constants import OPERATOR_GROUP_NAME, Perm
from app.rbac.models import Group
from app.rbac.services import seed_rbac
from app.settings.models import WorkshopSettings

SETTINGS_KWH = Decimal("200.00")
SETTINGS_MULTIPLIER = Decimal("1.50")  # -> margen 50 %
SETTINGS_WASTE = Decimal("8.00")
SETTINGS_LABOR_PER_HOUR = Decimal("600.00")
SETTINGS_DEFAULT_LABOR_MINUTES = 30

# Todo lo que el operador NO puede imponer (costos y margen del taller).
ABSURD_COSTS = {
    "kwh_cost": 9999.00,
    "machine_power_watts": 9999.00,
    "machine_cost_per_hour": 9999.00,
    "profit_margin_pct": 900.00,
    "waste_purge_pct": 90.00,
    "labor_cost": 99999.00,
    "labor_cost_per_hour": 99999.00,
}
# Lo que sí decide el operador: el esfuerzo del pedido.
OPERATIONAL = {"labor_time_minutes": 20}


def D(value) -> Decimal:
    return Decimal(str(value))


@pytest.fixture
def workshop(app, rbac):
    """Catálogo + Operador/Operadores, dos impresoras y settings con impresora A por defecto."""
    with app.app_context():
        seed_rbac()
        printer_a = Printer(name="Bambu A1", power_watts=Decimal("120.00"), cost_per_hour=Decimal("300.00"))
        printer_b = Printer(name="Prusa MK4", power_watts=Decimal("200.00"), cost_per_hour=Decimal("500.00"))
        db.session.add_all([printer_a, printer_b])
        db.session.flush()
        db.session.add(
            WorkshopSettings(
                kwh_cost=SETTINGS_KWH,
                profit_multiplier=SETTINGS_MULTIPLIER,
                waste_purge_pct=SETTINGS_WASTE,
                labor_cost_per_hour=SETTINGS_LABOR_PER_HOUR,
                default_labor_time_minutes=SETTINGS_DEFAULT_LABOR_MINUTES,
                default_printer_id=printer_a.id,
            )
        )
        db.session.commit()
        ids = {
            "printer_a": printer_a.id,
            "printer_b": printer_b.id,
            "operators_group": Group.query.filter_by(name=OPERATOR_GROUP_NAME).one().id,
        }
        db.session.remove()

    operator = rbac.user("operaria")
    rbac.add_member(operator, ids["operators_group"])

    manager = rbac.user("encargada")
    rbac.add_member(manager, ids["operators_group"])
    rbac.assign_direct(manager, rbac.role("Encargado", [Perm.SETTINGS_UPDATE]), reason="maneja precios")

    ids.update(operator=operator, manager=manager)
    return ids


def _create_order(http_client, auth_headers, material) -> int:
    payload = {
        "client": {"name": "Cliente RBAC", "origin": "whatsapp", "phone": "+54 9 11 5555-0000"},
        "items": [
            {
                "material_id": material,
                "piece_description": "Soporte",
                "weight_g": 120.00,
                "print_time_minutes": 210,
                "quantity": 1,
            }
        ],
    }
    resp = http_client.post("/api/orders", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    return resp.get_json()["id"]


def _quote(http_client, headers, order_id, quote_vars):
    return http_client.post(f"/api/orders/{order_id}/quote", json={"quote_vars": quote_vars}, headers=headers)


# --- operador sin settings:update ------------------------------------------------------


def test_operator_cost_fields_are_replaced_by_settings_and_default_printer(
    http_client, auth_headers, material, rbac, workshop
):
    order_id = _create_order(http_client, auth_headers, material)

    resp = _quote(http_client, rbac.headers(workshop["operator"]), order_id, {**OPERATIONAL, **ABSURD_COSTS})

    assert resp.status_code == 200
    quote = resp.get_json()["quote"]
    assert D(quote["kwh_cost"]) == SETTINGS_KWH
    assert D(quote["profit_margin_pct"]) == Decimal("50")
    assert D(quote["machine_power_watts"]) == Decimal("120")
    assert D(quote["machine_cost_per_hour"]) == Decimal("300")
    assert quote["printer_id"] == workshop["printer_a"]


def test_operator_waste_and_labor_rate_come_from_settings_but_minutes_from_body(
    http_client, auth_headers, material, rbac, workshop
):
    order_id = _create_order(http_client, auth_headers, material)

    resp = _quote(http_client, rbac.headers(workshop["operator"]), order_id, {**OPERATIONAL, **ABSURD_COSTS})

    assert resp.status_code == 200
    quote = resp.get_json()["quote"]
    assert D(quote["waste_purge_pct"]) == SETTINGS_WASTE
    assert D(quote["labor_cost_per_hour"]) == SETTINGS_LABOR_PER_HOUR
    assert quote["labor_time_minutes"] == 20
    assert D(quote["labor_cost"]) == Decimal("200.00")  # 600 $/h * 20 min / 60


def test_operator_without_labor_minutes_uses_settings_default(
    http_client, auth_headers, material, rbac, workshop
):
    order_id = _create_order(http_client, auth_headers, material)

    resp = _quote(http_client, rbac.headers(workshop["operator"]), order_id, dict(ABSURD_COSTS))

    assert resp.status_code == 200
    quote = resp.get_json()["quote"]
    assert quote["labor_time_minutes"] == SETTINGS_DEFAULT_LABOR_MINUTES
    assert D(quote["labor_cost"]) == Decimal("300.00")  # 600 $/h * 30 min / 60


def test_operator_profit_multiplier_is_ignored(http_client, auth_headers, material, rbac, workshop):
    order_id = _create_order(http_client, auth_headers, material)

    resp = _quote(
        http_client, rbac.headers(workshop["operator"]), order_id, {**OPERATIONAL, "profit_multiplier": 10}
    )

    assert resp.status_code == 200
    assert D(resp.get_json()["quote"]["profit_margin_pct"]) == Decimal("50")


def test_operator_can_choose_printer_and_its_costs_are_used(
    http_client, auth_headers, material, rbac, workshop
):
    order_id = _create_order(http_client, auth_headers, material)

    resp = _quote(
        http_client,
        rbac.headers(workshop["operator"]),
        order_id,
        {**OPERATIONAL, **ABSURD_COSTS, "printer_id": workshop["printer_b"]},
    )

    assert resp.status_code == 200
    quote = resp.get_json()["quote"]
    assert quote["printer_id"] == workshop["printer_b"]
    assert D(quote["machine_power_watts"]) == Decimal("200")
    assert D(quote["machine_cost_per_hour"]) == Decimal("500")


def test_operator_can_quote_without_sending_cost_fields(http_client, auth_headers, material, rbac, workshop):
    order_id = _create_order(http_client, auth_headers, material)

    resp = _quote(http_client, rbac.headers(workshop["operator"]), order_id, dict(OPERATIONAL))

    assert resp.status_code == 200
    assert D(resp.get_json()["quote"]["kwh_cost"]) == SETTINGS_KWH


def test_operator_price_equals_manager_quoting_with_settings_values(
    http_client, auth_headers, material, rbac, workshop
):
    operator_order = _create_order(http_client, auth_headers, material)
    manager_order = _create_order(http_client, auth_headers, material)

    by_operator = _quote(
        http_client, rbac.headers(workshop["operator"]), operator_order, {**OPERATIONAL, **ABSURD_COSTS}
    ).get_json()
    by_manager = _quote(
        http_client,
        rbac.headers(workshop["manager"]),
        manager_order,
        {
            "kwh_cost": 200.00,
            "machine_power_watts": 120.00,
            "machine_cost_per_hour": 300.00,
            "profit_margin_pct": 50.00,
            "waste_purge_pct": 8.00,
            "labor_cost_per_hour": 600.00,
            "labor_time_minutes": 20,
            "printer_id": workshop["printer_a"],
        },
    ).get_json()

    assert by_operator["production_cost"] == by_manager["production_cost"]
    assert by_operator["suggested_sale_price"] == by_manager["suggested_sale_price"]


def test_operator_without_any_printer_gets_422(app, http_client, auth_headers, material, rbac, workshop):
    with app.app_context():
        settings = WorkshopSettings.query.one()
        settings.default_printer_id = None
        db.session.commit()
        db.session.remove()
    order_id = _create_order(http_client, auth_headers, material)

    resp = _quote(http_client, rbac.headers(workshop["operator"]), order_id, dict(OPERATIONAL))

    assert resp.status_code == 422
    assert "printer_id" in resp.get_json()["errors"]


def test_operator_can_adjust_informed_price(http_client, auth_headers, material, rbac, workshop):
    order_id = _create_order(http_client, auth_headers, material)
    headers = rbac.headers(workshop["operator"])
    assert _quote(http_client, headers, order_id, dict(OPERATIONAL)).status_code == 200

    resp = http_client.post(
        f"/api/orders/{order_id}/quote/confirm", json={"informed_price": 15000.00}, headers=headers
    )

    assert resp.status_code == 200
    body = resp.get_json()
    assert body["status"] == "presupuestado"
    assert D(body["quote"]["informed_price"]) == Decimal("15000")


# --- con settings:update ---------------------------------------------------------------


def test_manager_with_settings_update_keeps_custom_values(
    http_client, auth_headers, material, rbac, workshop
):
    order_id = _create_order(http_client, auth_headers, material)
    custom = {
        "kwh_cost": 150.00,
        "machine_power_watts": 130.00,
        "machine_cost_per_hour": 310.00,
        "profit_margin_pct": 40.00,
        "waste_purge_pct": 5.00,
        "labor_cost_per_hour": 650.00,
        "labor_time_minutes": 15,
    }

    resp = _quote(http_client, rbac.headers(workshop["manager"]), order_id, custom)

    assert resp.status_code == 200
    quote = resp.get_json()["quote"]
    assert D(quote["kwh_cost"]) == Decimal("150")
    assert D(quote["machine_power_watts"]) == Decimal("130")
    assert D(quote["machine_cost_per_hour"]) == Decimal("310")
    assert D(quote["profit_margin_pct"]) == Decimal("40")
    assert D(quote["waste_purge_pct"]) == Decimal("5")
    assert D(quote["labor_cost_per_hour"]) == Decimal("650")
    assert D(quote["labor_cost"]) == Decimal("162.50")  # 650 $/h * 15 min / 60
