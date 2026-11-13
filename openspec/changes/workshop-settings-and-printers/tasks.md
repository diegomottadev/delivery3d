# Tasks: workshop-settings-and-printers

## Apply — Implementation

- [x] Crear modelos `Printer` (`app/backend/app/printers/models.py`) y `WorkshopSettings` (`app/backend/app/settings/models.py`) con esquema normalizado 1FN-4FN.
- [x] Crear y aplicar migraciones Alembic aditivas (`b7189c4d92ef` y `c83921af7b4e`) en la base de datos MySQL `delivery3d`.
- [x] Implementar endpoints REST protegidos:
  - `GET`, `PUT /api/settings` (`app/backend/app/settings/routes.py`).
  - `GET`, `POST`, `PUT /api/printers` (`app/backend/app/printers/routes.py`).
- [x] Actualizar `app/backend/app/orders/pricing.py::compute_quote` con la fórmula proporcional por horas/minutos:
  `labor_cost = round(labor_cost_per_hour * (labor_time_minutes / 60))`.
- [x] Actualizar `app/backend/app/orders/models.py` (`OrderQuote`), `services.py` y `schemas.py` para almacenar y serializar `printer_id`, `labor_cost_per_hour` y `labor_time_minutes`, además del desglose `pricing`.
- [x] Crear vista de configuración en frontend `WorkshopSettingsView.jsx` con formulario de constantes y tabla de impresoras.
- [x] Actualizar `QuoteModal.jsx` para incluir selector de impresora, inputs de tarifa horaria y horas/minutos con flechas (`showButtons`), y cálculo reactivo en vivo.
- [x] Registrar ruta `/settings` y navegación en `app/frontend/src/App.js`.

## Verify — Verification (Show real console output)
- [x] Backend Unit & Integration Tests (`PYTHONPATH=. .venv/bin/pytest`) — **103 passed**.
- [x] Frontend Component Tests (`npm test -- --watchAll=false`) — **28 passed** en 7 suites.
- [x] Normalization Audit — Cumplimiento estricto de 1FN, 2FN, 3FN (costos derivados calculados on-read) y 4FN.
- [x] Environment Check — Contenedores `personal-nginx` (puerto 8080), `delivery3d-backend` y `delivery3d-frontend` operativos sin colisión con `lafken-nginx`.

## Sync — Persist Truth
- [x] Actualizar `openspec/project.md` con los dominios y entidades `printers` y `workshop_settings`.
- [x] Actualizar especificación viva de `orders` (`openspec/specs/orders/spec.md` y `circuit.md`).
- [x] Crear especificación viva del dominio `settings` (`openspec/specs/settings/spec.md` y `circuit.md`).

## Closure
- [x] Documentación completa bajo el estándar SSDD / OpenSpec.
