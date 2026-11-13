# Delta Specification: quote-calculation

> **Updated for the normalized schema.** `POST /api/orders/<id>/quote` now takes `{"quote_vars": {...}}` (workshop parameters only — filament cost comes from each `OrderItem`'s `Material.cost_per_kg`, not a payload field). `production_cost`/`suggested_sale_price` are computed on every response, never stored. All scenarios below match `app/backend/tests/orders/test_pricing.py` (16 tests) and `test_quote_calculation.py` (15 tests).

## ADDED Requirements

### Requirement: Automatic Production Cost and Suggested Sale Price Calculation
The system MUST calculate `production_cost` and `suggested_sale_price` for an Order in status `nuevo`, from its existing `OrderItem`s (weight, print time, quantity, each item's material cost/kg) and workshop cost parameters (`waste_purge_pct`, `machine_power_watts`, `kwh_cost`, `machine_cost_per_hour`, `labor_cost`, `profit_margin_pct`), without altering the Order's status or persisting the computed cost/price as columns.

#### Scenarios (SBE Example Matrix)
Currency: ARS. Single-item order unless noted (multi-item covered separately).

| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | 1 item: `weight_g=120.00, print_time_minutes=210, material_cost_per_kg=18000.00`; `quote_vars={waste_purge_pct:5, machine_power_watts:120, kwh_cost:150, machine_cost_per_hour:300, labor_cost:1500, profit_margin_pct:40}` | Order `nuevo` | `POST /api/orders/{id}/quote` | 200 OK; `production_cost="4881.00"`, `suggested_sale_price="6833.40"`, `status="nuevo"` |
| EX-02 | Boundary | `waste_purge_pct=0, profit_margin_pct=0` | Order `nuevo` | `POST /api/orders/{id}/quote` | 200 OK; `suggested_sale_price == production_cost` |
| EX-03 | Negative Case | `quote_vars.labor_cost=-1` | Order `nuevo` | `POST /api/orders/{id}/quote` | 422 Unprocessable Entity |
| EX-04 | Negative Case | Order currently `presupuestado` (already confirmed) | Order `presupuestado` | `POST /api/orders/{id}/quote` | 409 Conflict |
| EX-05 | Negative Case | Order does not exist | n/a | `POST /api/orders/99999/quote` | 404 Not Found |
| EX-06 | Multi-item | 2 items, different `material_id`/costs, one with `quantity=2` | Order `nuevo` | `POST /api/orders/{id}/quote` | 200 OK; filament cost = sum of each item's individually-rounded filament cost |
| EX-07 | Recalculation | Same order quoted twice with different `quote_vars` | Order `nuevo` | `POST /api/orders/{id}/quote` (2nd call) | 200 OK; latest `quote_vars` overwrite the previous `OrderQuote` row (upsert, no duplicate row, no history entry from calculation alone) |
| EX-08 | Negative / Unauthorized | No/invalid JWT | — | `POST /api/orders/{id}/quote` | 401 Unauthorized |
| EX-09 | Technical Database Limits | Item weight/cost combination whose `filament_cost` alone exceeds `DECIMAL(10,2)` capacity | Order `nuevo` | `POST /api/orders/{id}/quote` | 422 Unprocessable Entity; rejected before persistence |
| EX-10 | Technical Database Limits | `production_cost` sum exceeds capacity even though each component is individually under it | Order `nuevo` | `POST /api/orders/{id}/quote` | 422 Unprocessable Entity |
| EX-11 | Technical Database Limits | `suggested_sale_price` exceeds capacity due to `profit_margin_pct`, even though `production_cost` itself is under capacity | Order `nuevo` | `POST /api/orders/{id}/quote` | 422 Unprocessable Entity |

---

### Requirement: Quote Confirmation and Transition to `presupuestado`
The system MUST allow the operator to register `informed_price` and transition the Order from `nuevo` to `presupuestado`, recording the transition in `OrderStatusHistory`.

#### Scenarios (SBE Example Matrix)
| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | `informed_price=6800.00` | Order `nuevo`, quoted (EX-01 above) | `POST /api/orders/{id}/quote/confirm` | 200 OK; `status="presupuestado"`, `quote.informed_price="6800.00"`, `quote.quoted_at` set, 1 new `OrderStatusHistory` row `nuevo→presupuestado` |
| EX-02 | Boundary | `informed_price=0.00` | Order `nuevo`, quoted | `POST /api/orders/{id}/quote/confirm` | 422 Unprocessable Entity |
| EX-03 | Negative Case | `informed_price=-500.00` | Order `nuevo`, quoted | `POST /api/orders/{id}/quote/confirm` | 422 Unprocessable Entity |
| EX-04 | Negative Case | `informed_price="not-a-number"` | Order `nuevo`, quoted | `POST /api/orders/{id}/quote/confirm` | 422 Unprocessable Entity |
| EX-05 | Negative Case | `informed_price=100000000.00` (exceeds capacity) | Order `nuevo`, quoted | `POST /api/orders/{id}/quote/confirm` | 422 Unprocessable Entity |
| EX-06 | Negative Case | Re-confirm attempt | Order already `presupuestado` | `POST /api/orders/{id}/quote/confirm` | 409 Conflict; existing `informed_price` unchanged, no duplicate history row |
| EX-07 | Negative Case | No prior `calculate_quote` call | Order `nuevo`, no `OrderQuote` | `POST /api/orders/{id}/quote/confirm` | 409 Conflict |
| EX-08 | Negative Case | Order does not exist | n/a | `POST /api/orders/99999/quote/confirm` | 404 Not Found |
| EX-09 | Negative / Unauthorized | No/invalid JWT | — | `POST /api/orders/{id}/quote/confirm` | 401 Unauthorized |

---

## SBE Quality Checklist (Gojko Adzic Principles)
- [x] **Pure Domain Language**
- [x] **The Tester Test** — every scenario maps to a real test
- [x] **Concrete Example Table**
- [x] **Atomicity**

## Verified Against Real Tests
31 tests total (`test_pricing.py` 16 + `test_quote_calculation.py` 15), 100% line coverage on `app/orders/pricing.py`, run against real MySQL 8.0.

## Risks and Considerations (updated)
- **Resolved Red Cards:** rounding rule (round-half-up per component, documented in `design.md`), `print_time_minutes → print_time_hours` conversion (inside `pricing.py`), `changed_by` threading through `confirm_quote` — all resolved and tested.
- **Product decisions confirmed:** no upper bound on `deposit_amount`-adjacent concerns for this change (n/a here — see `order-lifecycle`); selling below `production_cost` is allowed silently, no warning (confirmed at the change-package Gate).
- **New: per-item filament cost rounding.** Each `OrderItem`'s filament cost is rounded independently before summing (not the sum rounded once) — verified by `test_multi_item_multi_material_sums_filament_cost_and_time`.
