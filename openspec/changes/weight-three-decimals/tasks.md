# Tasks: weight-three-decimals

## Apply — Implementation

- [x] Crear migración Alembic `d9401ab23e7f` para modificar `order_items.weight_g` a `DECIMAL(10, 3)`.
- [x] Aplicar migración en MySQL (`flask db upgrade`).
- [x] Modificar `backend/app/orders/models.py`: actualizar `OrderItem.weight_g` a `Numeric(10, 3)`.
- [x] Modificar `frontend/src/features/orders/OrderIntakeForm.jsx`: actualizar `InputNumber` a `maxFractionDigits={3}`, `min={0.001}`, `minFractionDigits={0}`.

## Verify — Verification
- [x] Ejecutar tests de backend (`pytest tests/orders/test_intake.py`) verificando almacenamiento y serialización de 3 decimales (`12.345`).
- [x] Ejecutar tests de frontend (`npm test -- --watchAll=false`).
- [x] Ejecutar suite completa de tests de regresión backend y frontend.

## Sync — Persist Truth
- [x] Actualizar `openspec/specs/orders/spec.md`.
- [x] Marcar tareas completadas en este archivo.
