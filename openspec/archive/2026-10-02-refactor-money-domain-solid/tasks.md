# Tasks: refactor-money-domain-solid

## Apply — Implementation

### ⚪ Characterize (tests que deben pasar YA, antes de tocar código)
- [x] Ejecutar `cd backend && PYTHONPATH=. .venv/bin/pytest -q` y anotar el total como base en este archivo *(transversal)*
- [x] Agregar en `backend/tests/cashbox/test_routes.py` un test que, con precio 8000.00 y seña 3000.00, verifique `pending_balance`=5000.00 y `total_paid`=3000.00 por `GET /balance` (EX-01) *(US-01)*
- [x] Agregar en `backend/tests/cashbox/test_routes.py` un test que cobre desde caja sin monto con los datos de EX-01 y verifique ingreso de 5000.00 (EX-03) *(US-01)*
- [x] Agregar en `backend/tests/cashbox/test_services.py` un test de `get_order_balance_info` para EX-04 (seña 3000 + ingreso manual 6000 sobre precio 8000 → 0.00) *(US-01)*
- [x] Agregar en `backend/tests/cashbox/test_services.py` un test de `get_order_balance_info` para EX-05 (sin precio → `informed_price` 0.00, saldo 0.00) *(US-01)*
- [x] Agregar en `backend/tests/cashbox/test_services.py` un test de `get_order_balance_info` para EX-06 (egreso 2000 asociado no reduce saldo de 15000) *(US-01)*
- [x] Agregar en `backend/tests/orders/test_lifecycle.py::TestApprove` aserciones de EX-07: `income_category_id` = id de la categoría de sistema `seña`, `user_id` = usuario autenticado, descripción "Seña inicial pedido #<id>" — autenticar con un usuario de id ≠ 1 (crear `User(id=2)` y token `sub="2"`), porque el default de `user_id` es 1 y la aserción sería vacía *(US-02)*
- [x] Agregar en `backend/tests/cashbox/test_routes.py` aserciones de EX-09 (= EX-02): `income_category_id` = id de `saldo_pedido`, `user_id` = usuario autenticado, descripción "Cobro saldo entrega pedido #<id>" — autenticar con un usuario de id ≠ 1 (crear `User(id=2)` y token `sub="2"`), porque el default de `user_id` es 1 y la aserción sería vacía *(US-02)*
- [x] Agregar en `backend/tests/orders/test_intake.py` test EX-13 (alta con filamento PLA, sin material ni costo → `material_cost_per_kg` 18000.00) *(US-03)*
- [x] Agregar en `backend/tests/orders/test_intake.py` test EX-14 (edición con ítem filamento PLA, sin material ni costo → 18000.00) *(US-03)*
- [x] Agregar en `backend/tests/orders/test_intake.py` test EX-14c (ítem sin filamento ni material → 422 en `items[0].filament_id`) *(US-03)*
- [x] Confirmar suite completa en verde con los tests nuevos *(transversal)*

### 🔴 RED
- [x] Agregar en `backend/tests/orders/test_lifecycle.py` test EX-15 (categoría de sistema `seña` borrada en DB, aprobar con seña 1500 → 409 con `seña` en `error`, sigue PRESUPUESTADO, 0 movimientos, 0 historial nuevo) *(US-02)*
- [x] Agregar en `backend/tests/orders/test_lifecycle.py` test EX-18 (`seña` de sistema borrada + categoría de usuario `code="anticipo_cliente"`, `name="seña"` → 409, 0 movimientos) *(US-02)*
- [x] Agregar en `backend/tests/orders/test_lifecycle.py` test EX-17 (`seña` borrada, seña 0 → 200 APROBADO) *(US-02)*
- [x] Agregar en `backend/tests/cashbox/test_routes.py` test EX-16 (`saldo_pedido` de sistema inactiva en DB, entregar con cobro → 409 con `saldo_pedido` en `error`, sigue LISTO, 0 `saldo_pedido`, 0 historial nuevo) *(US-02)*
- [x] Confirmar que EX-15, EX-16 y EX-18 fallan (hoy 200) y EX-17 pasa *(US-02)*

### 🟢 GREEN
- [x] Agregar `DECIMAL_10_2_MAX` y `DEFAULT_MATERIAL_COST_PER_KG` en `backend/app/money.py` *(US-03)*
- [x] Reemplazar la definición local de `DECIMAL_10_2_MAX` en `backend/app/orders/pricing.py` por import desde `app.money` *(US-03)*
- [x] Reemplazar la definición local de `DECIMAL_10_2_MAX` en `backend/app/cashbox/services.py` por import desde `app.money` *(US-03)*
- [x] Cambiar el import de `DECIMAL_10_2_MAX` en `backend/app/orders/services.py` a `app.money` *(US-03)*
- [x] Crear `backend/app/cashbox/balance.py` con `informed_price`, `total_paid`, `pending_from`, `pending_balance` *(US-01)*
- [x] Usar `informed_price`/`total_paid`/`pending_from` en `backend/app/cashbox/services.py::get_order_balance_info` *(US-01)*
- [x] Usar `pending_balance(order)` en `backend/app/cashbox/services.py::collect_order_balance` y eliminar `Decimal(str(balance_info["pending_balance"]))` *(US-01)*
- [x] Reemplazar `_pending_balance` por `pending_balance` en `backend/app/orders/services.py::transition_order` y borrar `_pending_balance` *(US-01)*
- [x] Agregar en `backend/tests/cashbox/test_services.py` test RED: `add_movement(...)` + `db.session.rollback()` → 0 movimientos *(US-02)*
- [x] Extraer `add_movement` (sin commit) en `backend/app/cashbox/services.py` y hacer que `create_movement` la envuelva con commit *(US-02)*
- [x] Crear `_system_income_category(order_id, code)` en `backend/app/orders/services.py` (filtro `code`, `is_system=True`, `is_active=True`) *(US-02)*
- [x] Resolver la categoría de sistema antes del UPDATE en `backend/app/orders/services.py::transition_order` cuando seña > 0 o cobro > 0 *(US-02)*
- [x] Reemplazar el `CashMovement(...)` de seña en `backend/app/orders/services.py::transition_order` por `add_movement(..., category_id=...)` *(US-02)*
- [x] Reemplazar el `CashMovement(...)` de saldo en `backend/app/orders/services.py::transition_order` por `add_movement(..., category_id=...)` *(US-02)*
- [x] Extraer `_resolve_cost_per_kg` (conservando el `or` actual: un 0 numérico cae al default, ver bug conocido en spec-delta) y `_build_order_item` en `backend/app/orders/services.py` y usarlos en `create_order` y `update_order` *(US-03)*
- [x] Usar `DEFAULT_MATERIAL_COST_PER_KG` en `backend/app/orders/services.py::_pricing_items` *(US-03)*

### 🔵 REFACTOR
- [x] Eliminar de `backend/app/orders/services.py` los imports que ruff marque F401 (previsto: `CashMovementType`; `CashMovement` se mantiene por `delete_order`, `CashIncomeCategory` por `_system_income_category`) *(transversal)* — ruff sin F401: `CashMovementType` sigue en uso (`type=CashMovementType.INGRESO.value` en `add_movement`), no hubo imports que eliminar

### Scope guards
- Do NOT touch: `*/routes.py`, modelos, migraciones, frontend, lógica de `compute_quote`, CRUD de categorías.

## Analyze — 2026-10-02
- Characterize (2026-10-02): base 184 passed. EX-14b retirado: el código actual acepta costo 0 numérico y aplica 18000.00 (bug, fuera de alcance, se corrige con `/debug` después).
- Resultado: sin CRITICAL ni HIGH. 1 MEDIUM corregido: aserción de `user_id` en EX-07/EX-09 era vacía (usuario autenticado de los tests = id 1 = default). FK `income_category_id` es `RESTRICT`: borrar la categoría en EX-15/EX-18 funciona porque `_clean_tables` deja 0 movimientos por test.

## Verify — Verification (Show real console output)
- [x] `cd backend && .venv/bin/ruff check app/ tests/ seeds/`
- [x] `cd backend && PYTHONPATH=. .venv/bin/pytest -v` — 100% verde (total ≥ base anotada + tests nuevos)
- [x] `grep -rn '18000' backend/app` → solo `app/money.py`; `grep -rn 'DECIMAL_10_2_MAX =' backend/app` → solo `app/money.py`
- [x] `grep -n 'CashMovement(' backend/app/orders/services.py` → 0 resultados
- [x] `spec-reviewer` ∥ `dba-optimizer` ∥ `runtime-verifier` — spec: PASS tras agregar test EX-12 (verificado por mutación) y completar EX-08; runtime: 18/18 PASS; DBA: sin BLOCKING (mejora de lock en approve/deliver, −2 queries en collect-balance)

## Sync — Persist Truth
- [x] Reemplazar REQ-CASH-03 en `openspec/specs/cashbox/spec.md` por la versión MODIFIED (fórmula: suma de ingresos)
- [x] Actualizar "Order Lifecycle Transitions" en `openspec/specs/orders/spec.md` con la vinculación a categoría de sistema y el rechazo 409
- [x] Agregar el requisito "Costo por kg por defecto de un ítem" en `openspec/specs/orders/spec.md`
- [x] Actualizar `openspec/specs/cashbox/circuit.md` y `openspec/specs/orders/circuit.md` (nuevo `balance.py`, `add_movement`)

## Fix posterior (2026-10-02)
- [x] Bug costo 0: RED `test_zero_cost_per_kg_*` (3 fallos) → GREEN en `backend/app/orders/schemas.py` y `_resolve_cost_per_kg` (`is None` en lugar de `or`). Suite final: 207 passed, ruff limpio.

## Follow-ups (otro change)
- Carrera de doble cobro de saldo (preexistente): lock `FOR UPDATE` en pedido + SUM con lock o READ COMMITTED.
- `collect_order_balance` todavía resuelve categoría por `code OR name` sin `is_system`.
- Pendientes de la revisión SOLID: `TRANSITION_EFFECTS`, CRUD de categorías unificado, default `user_id=1`.

## Closure
- [x] Preparar commit message (`commit-message-writer`) — NO commitear automáticamente
- [x] Archivar en `openspec/archive/YYYY-MM-DD-refactor-money-domain-solid/` con `Status: done`
