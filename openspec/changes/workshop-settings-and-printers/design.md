# Design: workshop-settings-and-printers

## Involved Files (real paths)
- `backend/app/settings/models.py`
- `backend/app/settings/routes.py`
- `backend/app/printers/models.py`
- `backend/app/printers/routes.py`
- `backend/app/orders/models.py`
- `backend/app/orders/pricing.py`
- `backend/app/orders/services.py`
- `backend/app/orders/schemas.py`
- `backend/migrations/versions/b7189c4d92ef_add_printers_and_workshop_settings.py`
- `backend/migrations/versions/c83921af7b4e_add_labor_rate_and_time.py`
- `backend/tests/test_settings.py`
- `backend/tests/test_printers.py`
- `backend/tests/orders/test_pricing.py`
- `backend/tests/orders/test_quote_calculation.py`
- `frontend/src/features/orders/ordersApi.js`
- `frontend/src/features/orders/QuoteModal.jsx`
- `frontend/src/features/settings/WorkshopSettingsView.jsx`
- `frontend/src/features/orders/QuoteModal.test.js`
- `frontend/src/features/settings/WorkshopSettingsView.test.js`
- `frontend/src/App.js`

## Technical Approach
1. **Normalización 1FN a 4FN/BCNF:**
   - **1FN:** Valores atómicos, claves primarias enteras autoincrementales explícitas en `printers` y `workshop_settings`.
   - **2FN:** Dependencia funcional completa de las claves primarias (no hay claves compuestas con dependencias parciales).
   - **3FN:** No existen dependencias transitivas; los costos derivados (`production_cost`, `suggested_sale_price`, `filament_cost`, `electricity_cost`, `machine_cost`, `labor_cost`) se calculan on-read dinámicamente mediante `compute_quote` y nunca se persisten en columnas redundantes.
   - **4FN / BCNF:** La asignación de impresoras y parámetros de taller se desacopla en tablas independientes sin dependencias multivaluadas no triviales.
2. **Fórmula de Mano de Obra:**
   $$\text{labor\_cost} = \text{round}\left(\text{labor\_cost\_per\_hour} \times \frac{\text{labor\_time\_minutes}}{60}\right)$$
   Utiliza aritmética exacta con `Decimal` y redondeo `ROUND_HALF_UP` a dos decimales.
3. **Carga y Edición de Valores:**
   Al abrir la cotización (`QuoteModal`), se cargan las constantes globales desde `GET /api/settings`. Los valores sirven de pre-llenado por defecto, permitiendo al operador ajustarlos libremente por pedido sin modificar la configuración global.

## Constants / Enums / Magic IDs
- Valores por defecto en `workshop_settings`:
  - `kwh_cost`: `278.00` ARS
  - `waste_purge_pct`: `10.00` %
  - `labor_cost_per_hour`: `650.00` ARS/h
  - `default_labor_time_minutes`: `15` minutos
  - `profit_multiplier`: `2.00` (x2)
- Impresoras semilla iniciales:
  - Bambu Lab A1 (120W, $100.00/h)
  - Bambu Lab P1S (160W, $150.00/h)
  - Creality Ender 3 (150W, $80.00/h)

## Security & Permissions
- Todos los endpoints de `/api/settings` y `/api/printers` están protegidos por el decorador `@login_required` (verificación de token JWT Bearer).

## ⚠️ High-Risk Files / Modules
- `backend/app/orders/pricing.py`: Lógica financiera de cotización. Cobertura obligatoria del 100%. Debe manejar validaciones de tipos, valores negativos y precisión `Decimal`.
- `backend/app/orders/models.py` (`OrderQuote`): Restricciones `CheckConstraint` para asegurar que tarifas y tiempos no admitan valores negativos.

## Impact on Data / Integraciones
- **Base de Datos:**
  - Creación de tabla `printers`.
  - Creación de tabla `workshop_settings` (con FK a `printers.id`).
  - Alteración aditiva en `order_quotes`: adición de `printer_id`, `labor_cost_per_hour` y `labor_time_minutes`.
- **Migraciones Alembic:**
  - `b7189c4d92ef`: Creación de `printers`, `workshop_settings` y FK en `order_quotes`.
  - `c83921af7b4e`: Adición de `labor_cost_per_hour` y `labor_time_minutes` a ambas tablas.

## Decisions (Short ADR)
- **Decisión:** Almacenar `labor_time_minutes` como entero atómico en la base de datos y descomponer en `horas` y `minutos` en la UI.
  - **Alternativa descartada:** Guardar horas y minutos en dos columnas separadas en la base de datos o guardar horas como número flotante (ej. 0.25).
  - **Razón:** Un entero en minutos evita errores de redondeo en punto flotante y simplifica las restricciones de integridad y normalización.
- **Decisión:** Mantener `labor_cost` calculado on-read en `pricing.py` y guardar los factores atómicos (`labor_cost_per_hour`, `labor_time_minutes`).
  - **Alternativa descartada:** Persistir únicamente el monto final de mano de obra.
  - **Razón:** Pérdida de trazabilidad de cuántas horas/minutos y a qué tarifa se cotizó la orden originalmente.

---

## Inventory of Built Artifacts

### Database
- [x] **Create** table `printers` (`id`, `name`, `model`, `power_watts`, `cost_per_hour`, `is_active`, `created_at`, `updated_at`).
- [x] **Create** table `workshop_settings` (`id`, `kwh_cost`, `waste_purge_pct`, `labor_cost`, `labor_cost_per_hour`, `default_labor_time_minutes`, `profit_multiplier`, `default_printer_id`, `updated_at`).
- [x] **Modify** table `order_quotes` (agrega `printer_id`, `labor_cost_per_hour`, `labor_time_minutes`).

### Backend
- [x] **Create** Blueprint `settings_bp` (`GET /api/settings`, `PUT /api/settings`).
- [x] **Create** Blueprint `printers_bp` (`GET /api/printers`, `POST /api/printers`, `PUT /api/printers/<id>`).
- [x] **Modify** `pricing.py::compute_quote` para calcular mano de obra con tarifa horaria y tiempo en minutos.
- [x] **Modify** `services.py::calculate_quote` y `get_order_pricing` para persistir y procesar los nuevos atributos.
- [x] **Modify** `schemas.py::serialize_order` para incluir desglose `pricing` y atributos de mano de obra en `quote`.

### Frontend
- [x] **Create** `frontend/src/features/settings/WorkshopSettingsView.jsx` — Administración de constantes e impresoras.
- [x] **Modify** `frontend/src/features/orders/QuoteModal.jsx` — Selector de impresora, inputs de horas/minutos y badge de cálculo reactivo.
- [x] **Modify** `frontend/src/features/orders/ordersApi.js` — Funciones de API (`getSettings`, `updateSettings`, `listPrinters`, `createPrinter`, `updatePrinter`).
- [x] **Modify** `frontend/src/App.js` — Registro de ruta `/settings` y navegación en menú lateral.

### Tests
- [x] **Create** `tests/test_settings.py` — Tests de lectura, actualización y restricciones de autorización.
- [x] **Create** `tests/test_printers.py` — Tests de listado, creación y edición de impresoras.
- [x] **Modify** `tests/orders/test_pricing.py` — Test unitario de la fórmula de mano de obra horaria/minutero.
- [x] **Modify** `tests/orders/test_quote_calculation.py` — Test de cálculo y persistencia de cotización completa.
- [x] **Create** `features/settings/WorkshopSettingsView.test.js` — Test de render y carga de datos.
- [x] **Modify** `features/orders/QuoteModal.test.js` — Tests de inputs de mano de obra y envío de payload.
