# Tasks: order-lifecycle

## Apply — Implementation

### Option B — Granular Tasks (manual change)

- [x] Leer `app/backend/app/orders/` (extendido por `order-intake` y `quote-calculation`) y seguir el mismo patrón (skill `architecture-first`).
- [x] **[Revisión post-normalización]** Esquema de base de datos verificado: se utiliza la tabla `cash_movements` (creada en la migración normalizada `a1b86c4c24db`) para registrar señas al aprobar, sin necesidad de agregar columna `deposit_amount` a `orders`.
- [x] Crear `app/backend/app/orders/state_machine.py::VALID_TRANSITIONS` como mapa 1 a 1 (`presupuestado→aprobado→imprimiendo→listo→entregado`) y función validadora `is_valid_transition`.
- [x] Crear `app/backend/app/orders/services.py::transition_order(order_id, target_status, changed_by, deposit_amount=None)` — valida la transición contra `VALID_TRANSITIONS`, aplica `deposit_amount` creando `CashMovement` atómico solo si `target_status == aprobado`, actualiza `order.status` y agrega fila a `order_status_history` en una transacción atómica con guarda optimista (`UPDATE ... WHERE status = <status_esperado>`).
- [x] Crear `app/backend/app/orders/services.py::get_order_history(order_id)` — estado actual + historial ordenado cronológicamente.
- [x] Agregar a `app/backend/app/orders/routes.py`: `POST /api/orders/<order_id>/approve`, `/start-printing`, `/mark-ready`, `/deliver` (resuelven `changed_by` desde `g.current_user_id`), protegidos con `@login_required`.
- [x] Agregar a `app/backend/app/orders/routes.py`: `GET /api/orders/<order_id>/history` (estado actual + historial completo).
- [x] Agregar a `app/frontend/src/features/orders/ordersApi.js`: `approveOrder`, `startPrinting`, `markReady`, `deliverOrder`, `getOrderHistory`.
- [x] Crear `app/frontend/src/features/orders/OrderBoard.jsx` — tablero por columnas de estado con acciones de avance (`presupuestado→aprobado→imprimiendo→listo→entregado`), modal de seña para caja e historial (panel izquierdo del dashboard, `Project.md` §5).

## Verify — Verification (Show real console output)
- [x] Run project linter (`ruff check app/ tests/ seeds/`) — All checks passed.
- [x] Clear cache / build assets if applicable — Tests de frontend `OrderBoard.test.js`: **2 passed** (Jest/RTL).
- [x] Unit and integration tests (`pytest tests/orders/test_lifecycle.py -v`) — **23 passed** contra MySQL real (`delivery3d_test`).
- [ ] Code review & database query check (`spec-reviewer` ∥ `dba-optimizer`)
- [x] Test coverage: **100%** en `state_machine.py`, cobertura completa de transiciones, validaciones de seña y concurrencia.

## Sync — Persist Truth
- [x] Merge delta spec into `openspec/specs/orders/spec.md` (the WHAT)
- [x] Update technical flow in `openspec/specs/orders/circuit.md` (the HOW) — documentar el diagrama de estados completo del pedido
- [x] Record database migrations (reutiliza migración normalizada `a1b86c4c24db`)
- [x] Update technical documentation if needed

## Closure
- [ ] Prepare commit message (`commit-message-writer`) — DO NOT commit automatically
- [ ] Archive: move change to `openspec/archive/YYYY-MM-DD-order-lifecycle/` and set status: done
