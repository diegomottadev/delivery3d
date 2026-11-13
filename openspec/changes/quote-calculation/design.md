# Design: quote-calculation

> **Superseded schema notice:** igual que `order-intake`, este change se rediseñó sobre el esquema normalizado a mitad de implementación. `production_cost`/`suggested_sale_price` **NO son columnas** (3FN) — se calculan on-read. La cotización ahora es multi-ítem/multi-material (cada `OrderItem` puede tener un `Material` con `cost_per_kg` distinto), no un único `filament_cost_per_kg` a nivel pedido.

## Involved Files (real paths — implementados)
- `app/backend/app/orders/models.py` — agrega `OrderQuote` (1:1 con `Order` vía `order_id UNIQUE`; parámetros de costo del taller + `informed_price`/`quoted_at`; **sin** columnas de costo calculado).
- `app/backend/app/orders/pricing.py` — `compute_quote(items, quote_vars) -> QuoteResult`, función pura, agrega costo de filamento **por ítem** (cada uno con su propio `material_cost_per_kg`) y tiempo total; redondeo `round-half-up` por componente con `Decimal`.
- `app/backend/app/orders/services.py` — `calculate_quote(order_id, quote_vars)`, `confirm_quote(order_id, informed_price, changed_by)`, `get_order_pricing(order)` (cálculo on-read para serialización), `_pricing_items(order)` (helper compartido).
- `app/backend/app/orders/routes.py` — agrega `POST /api/orders/<order_id>/quote`, `POST /api/orders/<order_id>/quote/confirm`.
- `app/backend/tests/orders/test_pricing.py` (16 tests, unitarios sobre `compute_quote`) y `test_quote_calculation.py` (15 tests, integración HTTP).

## Technical Approach
`compute_quote(items, quote_vars)` recibe:
- `items`: `[{weight_g, print_time_minutes, quantity, material_cost_per_kg}, ...]` — uno por `OrderItem`, con el `cost_per_kg` de **su propio** `Material` (no un valor único de pedido).
- `quote_vars`: `{waste_purge_pct, machine_power_watts, kwh_cost, machine_cost_per_hour, labor_cost, profit_margin_pct}` — parámetros de `OrderQuote`, aplican al trabajo completo (no por ítem).

Fórmula (extensión multi-ítem de la fórmula original de `Project.md` §3):
```
para cada item i:
    purge_adjusted_weight_g_i = weight_g_i * quantity_i * (1 + waste_purge_pct / 100)
    filament_cost_i = round_half_up((purge_adjusted_weight_g_i / 1000) * material_cost_per_kg_i, 2)
filament_cost = sum(filament_cost_i)
total_time_minutes = sum(print_time_minutes_i * quantity_i)
print_time_hours = total_time_minutes / 60
electricity_cost = round_half_up((machine_power_watts / 1000) * print_time_hours * kwh_cost, 2)
machine_cost = round_half_up(machine_cost_per_hour * print_time_hours, 2)
production_cost = filament_cost + electricity_cost + machine_cost + labor_cost
suggested_sale_price = round_half_up(production_cost * (1 + profit_margin_pct / 100), 2)
```
Con un solo ítem, esta fórmula produce exactamente los mismos números que la versión original de un solo material (verificado: `test_ex01_happy_path_single_item` reproduce `production_cost=4881.00`, `suggested_sale_price=6833.40` del diseño original).

`calculate_quote` NO cambia `order.status`; `confirm_quote` sí (transición `nuevo → presupuestado`), y es quien recibe `changed_by` (resuelto server-side desde el JWT) para la fila de `OrderStatusHistory`.

**Redondeo:** cada componente intermedio (`filament_cost` por ítem, `electricity_cost`, `machine_cost`) se redondea a 2 decimales con `Decimal(...).quantize(Decimal("0.01"), ROUND_HALF_UP)` antes de sumar.

## Constants / Enums / Magic IDs
- Reutiliza `OrderStatus.PRESUPUESTADO` ("presupuestado").
- `DECIMAL_10_2_MAX = Decimal("99999999.99")` en `pricing.py` — techo de validación para toda cifra monetaria calculada, antes de intentar persistir.

## Security & Permissions
- Mismos endpoints protegidos por `@login_required`. `confirm_quote` recibe `changed_by=g.current_user_id`.

## ⚠️ High-Risk Files / Modules
- **`pricing.py` — 100% cobertura de tests exigida y alcanzada** (16 tests unitarios cubren: happy path, boundary 0%/1%, negativos, límites de `DECIMAL(10,2)` a nivel de ítem y a nivel de suma total, redondeo con más de 2 decimales, multi-ítem/multi-material).
- `OrderQuote` es 1:1 con `Order` — un `order_id` duplicado viola la constraint `UNIQUE`; `calculate_quote` hace upsert (`order.quote` ya existe → actualiza; si no, crea).

## Impact on Data / Integraciones
- Tabla `order_quotes` ya creada por la migración de normalización (`a1b86c4c24db`), compartida con `order-intake`. Sin integraciones externas.

## Decisions (Short ADR)
- **Decision:** costo de filamento por ítem (no un único `filament_cost_per_kg` de pedido).
  - **Reason:** requisito del esquema normalizado — cada `OrderItem` referencia su propio `Material`, y distintas piezas de un mismo pedido pueden usar materiales distintos.
- **Decision:** `production_cost`/`suggested_sale_price` nunca se persisten; se calculan on-read (`get_order_pricing`) y se devuelven en la respuesta HTTP, pero no existen como columnas.
  - **Reason:** 3FN — evita que un valor derivado quede desincronizado si cambian los ítems o los parámetros de cotización.
- **Decision:** Redondeo `round-half-up` por componente, con `Decimal` (nunca `float`).
  - **Reason:** módulo de alto riesgo financiero; evita arrastre de error de punto flotante.

---

## Inventory of Built Artifacts

### Database
- [x] Tabla `order_quotes` (creada junto con la normalización; usada por este change).

### Backend
- [x] `pricing.py::compute_quote(items, quote_vars)` — 100% cobertura.
- [x] `OrdersService::calculate_quote(order_id, quote_vars)` — upsert de `OrderQuote`, sin cambiar estado.
- [x] `OrdersService::confirm_quote(order_id, informed_price, changed_by)` — transición `nuevo → presupuestado`.
- [x] `OrdersService::get_order_pricing(order)` — cálculo on-read compartido por `list`/`get`/`quote`/`confirm`.
- [x] `orders_bp` — agrega `POST /quote`, `POST /quote/confirm`.

### Frontend
- [ ] Diferido.

### Tests
- [x] `test_pricing.py` (16 tests, 100% cobertura) + `test_quote_calculation.py` (15 tests de integración HTTP).

**Lo que este change explícitamente NO toca:** transiciones posteriores a `presupuestado`, seña/anticipo, movimientos de caja.
