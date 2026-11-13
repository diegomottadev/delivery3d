# Tasks: order-intake

## Apply — Implementation

### Option B — Granular Tasks (manual change)

- [x] Confirmar el proyecto de referencia análogo (skill `architecture-first`) — n/a: primer módulo del repo (greenfield), documentado explícitamente en `design.md`.
- [x] Inicializar el proyecto Python: `app/backend/requirements.txt` (Flask, Flask-SQLAlchemy, Flask-Migrate, PyMySQL, `cryptography`, python-dotenv, pytest, pytest-cov, ruff) y `app/backend/.env.example`.
- [x] Crear `app/backend/app/extensions.py` con la instancia compartida `db = SQLAlchemy()`.
- [x] Crear `app/backend/app/auth/security.py::login_required` — decorador placeholder (requiere JWT válido, resuelve `g.current_user_id` desde el claim `sub`, default al seed `id=1`).
- [x] Crear `app/backend/app/auth/models.py` con `User` stub mínimo (`id`, `username`, `password_hash` sin usar, `created_at`).
- [x] **[Revisión post-normalización]** Crear `app/backend/app/clients/models.py` (`Client`) y `app/backend/app/materials/models.py` (`Material`) como entidades propias — reemplaza el plan original de campos inline en `Order`.
- [x] Crear `app/backend/app/orders/models.py` con `Order` (`client_id`, `user_id`, `status`), `OrderItem` (multi-pieza, `material_id` por ítem), `OrderStatus` (enum completo, valores en español) y `OrderStatusHistory`.
- [x] Crear el esqueleto Flask del application factory en `app/backend/app/__init__.py`.
- [x] Configurar Alembic (`app/backend/migrations/`) y generar+aplicar la migración inicial, y luego la migración de normalización (`a1b86c4c24db`) contra `delivery3d` (contenedor `mysql8`).
- [x] Crear `app/backend/seeds/seed_operator.py` y `app/backend/seeds/seed_materials.py` — ejecutados, operador `id=1` y 3 materiales sembrados.
- [x] Crear `app/backend/app/orders/schemas.py` con validación de `client_id`/`client` + `items[]` y serialización.
- [x] Crear `app/backend/app/orders/services.py::create_order(items, created_by, client_id=None, client=None)` — transacción atómica cliente (si es nuevo) + orden + N ítems + historial.
- [x] Crear `app/backend/app/orders/services.py::list_orders()` y `get_order(order_id)`.
- [x] Crear `app/backend/app/orders/routes.py` con `orders_bp` (3 endpoints), registrado en el application factory.
- [x] Crear `app/frontend/src/features/orders/ordersApi.js` con soporte para endpoints de orders y materials.
- [x] Crear `app/frontend/src/features/orders/OrderIntakeForm.jsx` con modal PrimeReact Dialog, validaciones de cliente e ítems multi-pieza.
- [x] Crear `app/frontend/src/features/orders/OrderList.jsx` con tabla PrimeReact DataTable, tags de estado y toolbar de alta.

## Verify — Verification (Show real console output)
- [x] Run project linter (`ruff check app/ tests/ seeds/`) — All checks passed.
- [x] Clear cache / build assets if applicable — Frontend test suite: **16 passed** (Jest/RTL) y build compilado con éxito.
- [x] Unit and integration tests (`pytest tests/orders/test_intake.py -v`) — **20 passed** contra MySQL real (`delivery3d_test`).
- [ ] Code review & database query check (`spec-reviewer` ∥ `dba-optimizer`)
- [x] Test coverage: **100%** en `app/orders` y `app/auth` (`--cov-report=term-missing`); AC-1 a AC-8 de `spec-delta.md` cubiertos.

## Sync — Persist Truth
- [x] Merge delta spec into `openspec/specs/orders/spec.md` (the WHAT)
- [x] Update technical flow in `openspec/specs/orders/circuit.md` (the HOW)
- [x] Record database migrations (Alembic revision para `orders` + `order_status_history`)
- [x] Update technical documentation if needed

## Closure
- [ ] Prepare commit message (`commit-message-writer`) — DO NOT commit automatically
- [ ] Archive: move change to `openspec/archive/YYYY-MM-DD-order-intake/` and set status: done
