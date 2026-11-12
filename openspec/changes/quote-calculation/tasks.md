# Tasks: quote-calculation

## Apply — Implementation

### Option B — Granular Tasks (manual change)

- [x] Leer `backend/app/orders/` creado por `order-intake` y seguir su mismo patrón (skill `architecture-first`) — no crear un módulo paralelo.
- [x] **[Revisión post-normalización]** Crear `backend/app/orders/pricing.py::compute_quote(items, quote_vars)` como función pura (sin acceso a DB), implementando la fórmula multi-ítem/multi-material de `design.md` con redondeo `round-half-up` por componente usando `Decimal`, no `float`.
- [x] **[Revisión post-normalización]** Crear `OrderQuote` en `backend/app/orders/models.py` (relación 1:1 con `Order`, tabla `order_quotes` creada en la migración `a1b86c4c24db`; `production_cost`/`suggested_sale_price` NO son columnas persistidas para cumplir 3FN).
- [x] Migración de base de datos (`a1b86c4c24db_normalize_schema_clients_materials_.py`) aplicada contra `delivery3d` (contenedor Docker `mysql8`).
- [x] Crear `backend/app/orders/services.py::calculate_quote(order_id, quote_vars)` — valida precondición (`status == NUEVO`), invoca `compute_quote`, persiste `OrderQuote` (upsert) sin cambiar estado.
- [x] Crear `backend/app/orders/services.py::confirm_quote(order_id, informed_price, changed_by)` — valida precondición (`status == NUEVO` y cálculo previo existente), persiste `informed_price`/`quoted_at`, transiciona `NUEVO → PRESUPUESTADO` y agrega fila a `order_status_history` (`changed_by` = id del operador autenticado), todo en una transacción atómica con guarda `WHERE status = 'nuevo'`.
- [x] Agregar a `backend/app/orders/routes.py`: `POST /api/orders/<order_id>/quote` y `POST /api/orders/<order_id>/quote/confirm` (resuelve `changed_by` desde `g.current_user_id`), protegidos con `@login_required`.
- [x] Agregar a `frontend/src/features/orders/ordersApi.js`: `calculateQuote`, `confirmQuote`.
- [x] Crear `frontend/src/features/orders/QuoteModal.jsx` — carga de parámetros del laminador/taller (Bambu A1), preview de costos calculados y confirmación de precio informado.

## Verify — Verification (Show real console output)
- [x] Run project linter (`ruff check app/ tests/ seeds/`) — All checks passed.
- [x] Clear cache / build assets if applicable — Tests de frontend `QuoteModal.test.js`: **2 passed** (Jest/RTL).
- [x] Unit and integration tests (`pytest tests/orders/test_pricing.py tests/orders/test_quote_calculation.py -v`) — **31 passed** contra MySQL real (`delivery3d_test`).
- [ ] Code review & database query check (`spec-reviewer` ∥ `dba-optimizer`)
- [x] Test coverage: **100%** en `app/orders/pricing.py` (módulo de alto riesgo financiero) y endpoints `/quote`, `/quote/confirm` cubiertos.

## Sync — Persist Truth
- [x] Merge delta spec into `openspec/specs/orders/spec.md` (the WHAT)
- [x] Update technical flow in `openspec/specs/orders/circuit.md` (the HOW)
- [x] Record database migrations (tabla `order_quotes` incluida en revisión Alembic `a1b86c4c24db`)
- [x] Update technical documentation if needed

## Closure
- [ ] Prepare commit message (`commit-message-writer`) — DO NOT commit automatically
- [ ] Archive: move change to `openspec/archive/YYYY-MM-DD-quote-calculation/` and set status: done
