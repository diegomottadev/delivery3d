# Tasks: cashbox-management

## Apply — Implementation

- [x] Modificar modelos:
  - [x] `backend/app/settings/models.py`: agregar `currency_code` y `currency_symbol` a `WorkshopSettings`.
  - [x] `backend/app/cashbox/models.py`: agregar `description` a `CashMovement` y método `to_dict()`.
- [x] Generar y ejecutar migración de base de datos Alembic aditiva (`8b56eb6b8347`) en MySQL `delivery3d`.
- [x] Actualizar `backend/app/settings/routes.py` para validar y actualizar `currency_code` y `currency_symbol`.
- [x] Implementar capa de servicios de caja (`backend/app/cashbox/services.py`):
  - [x] `create_movement`
  - [x] `get_cash_summary`
  - [x] `list_movements`
  - [x] `get_order_balance_info`
  - [x] `collect_order_balance`
- [x] Implementar rutas REST protegidas de caja (`backend/app/cashbox/routes.py`) y registrar blueprint en `backend/app/__init__.py`.
- [x] Actualizar flujo de entrega de pedidos en `backend/app/orders/services.py` y `routes.py` para permitir cobro opcional o automático de saldo pendiente.
- [x] Escribir tests backend en `backend/tests/cashbox/test_services.py` y `backend/tests/cashbox/test_routes.py`.
- [x] Actualizar `WorkshopSettingsView.jsx` en frontend con selector de moneda latinoamericana/internacional (ARS, USD, CLP, COP, MXN, UYU, EUR) y campos correspondientes.
- [x] Crear cliente API `frontend/src/features/cashbox/cashboxApi.js`.
- [x] Crear componente de vista `frontend/src/features/cashbox/CashboxView.jsx` (tarjetas métricas, modales de ingreso/egreso, tabla de movimientos).
- [x] Integrar cobro de saldo en entrega de pedidos en `frontend/src/features/orders/OrderBoard.jsx`.
- [x] Registrar ruta `/cashbox` en `frontend/src/App.js` y entrada en `frontend/src/AppMenu.js`.
- [x] Escribir tests frontend para componentes y flujos de caja y configuración.

## Verify — Verification
- [x] Ejecutar suite completa de tests backend (`pytest -v`) — **122 passed**.
- [x] Ejecutar linter backend (`ruff check`) — **All checks passed (0 errors)**.
- [x] Ejecutar suite completa de tests frontend (`npm test -- --watchAll=false`) — **35 passed (8 test suites)**.
- [x] Verificar auditoría de normalización (1FN, 2FN, 3FN: balance derivado on-read sin persistencia redundante, 4FN: atributos atómicos desacoplados).

## Sync — Persist Truth
- [x] Actualizar o crear especificaciones vivas de dominio:
  - [x] `openspec/specs/cashbox/spec.md`
  - [x] `openspec/specs/cashbox/circuit.md`
  - [x] `openspec/specs/settings/spec.md`
- [x] Actualizar `openspec/project.md` con el estado actualizado del dominio `cashbox`.

## Closure
- [x] Documentación completa bajo el estándar SSDD / OpenSpec.
