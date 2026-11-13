# Design: cashbox-management

## Involved Files (real paths)
- `app/backend/app/cashbox/models.py`
- `app/backend/app/cashbox/services.py`
- `app/backend/app/cashbox/routes.py`
- `app/backend/app/cashbox/schemas.py`
- `app/backend/app/settings/models.py`
- `app/backend/app/settings/routes.py`
- `app/backend/app/orders/services.py`
- `app/backend/app/orders/routes.py`
- `app/backend/app/__init__.py`
- `app/backend/migrations/versions/...`
- `app/backend/tests/cashbox/test_services.py`
- `app/backend/tests/cashbox/test_routes.py`
- `app/frontend/src/features/cashbox/cashboxApi.js`
- `app/frontend/src/features/cashbox/CashboxView.jsx`
- `app/frontend/src/features/cashbox/CashboxView.test.js`
- `app/frontend/src/features/settings/WorkshopSettingsView.jsx`
- `app/frontend/src/features/orders/OrderBoard.jsx`
- `app/frontend/src/App.js`

## Technical Approach
1. **Normalización y Balance Dinámico (3FN):**
   - Siguiendo los principios de diseño de bases de datos del proyecto (1FN a 4FN), **no** se almacena un saldo acumulado en una columna persistida.
   - El saldo actual se calcula dinámicamente on-read mediante agregaciones `SUM(amount)` discriminadas por `type = 'ingreso'` vs `type = 'egreso'` en una consulta SQL optimizada con índice en `(type, amount)`.
   - Se utiliza `Decimal` de Python con redondeo `ROUND_HALF_UP` en todas las operaciones aritméticas para garantizar consistencia financiera.

2. **Categorías y Trazabilidad:**
   - Tipos de movimiento: `CashMovementType.INGRESO` ('ingreso') y `CashMovementType.EGRESO` ('egreso').
   - Categorías estándar:
     - Ingresos: `'seña'`, `'saldo_pedido'`, `'extraordinario'`, `'otro'`.
     - Egresos: `'filamento'`, `'repuestos'`, `'servicios'`, `'embalaje'`, `'otro'`.
   - Campo `description` (VARCHAR(255), nullable) para especificar el detalle del egreso o ingreso (ej. "Bobina PETG Negro Grilon", "Boquilla de acero endurecido 0.4 Bambu", etc.).
   - Auditoría obligatoria con `user_id` vinculado al operador autenticado (`g.current_user_id`) y `created_at` UTC.

3. **Cobro de Saldo de Pedidos (`collect_order_balance`):**
   - Dado un pedido (`order_id`):
     - Se verifica su precio cotizado e informado (`order.informed_price` o `pricing.suggested_sale_price`).
     - Se calculan los ingresos ya registrados vinculados a ese `order_id` (señas y anticipos previos).
     - El saldo restante es `pending_balance = max(0, informed_price - total_paid)`.
     - Al invocar el cobro (o al marcar el pedido como `entregado`), se registra un `CashMovement` de tipo `ingreso`, categoría `'saldo_pedido'`, asociado a `order_id`.

4. **Moneda Configurable:**
   - La tabla `workshop_settings` incorpora:
     - `currency_code`: VARCHAR(3), NOT NULL, default `'ARS'`.
     - `currency_symbol`: VARCHAR(10), NOT NULL, default `'AR$'`.
   - El endpoint `GET /api/cashbox/summary` y `GET /api/settings` devuelven estos campos para formatear las cantidades en la interfaz de usuario.
   - El frontend permite elegir monedas comunes (ARS, USD, CLP, COP, MXN, UYU, EUR) o ingresar una personalizada.

## Constants / Enums / Magic IDs
- `CashMovementType`:
  - `INGRESO = 'ingreso'`
  - `EGRESO = 'egreso'`
- Categorías sugeridas:
  - Ingresos: `['seña', 'saldo_pedido', 'extraordinario', 'otro']`
  - Egresos: `['filamento', 'repuestos', 'servicios', 'embalaje', 'mantenimiento', 'otro']`
- Monedas estándar soportadas en selector:
  - `ARS` -> `AR$` (Pesos Argentinos)
  - `USD` -> `US$` (Dólares Estadounidenses)
  - `CLP` -> `CLP$` (Pesos Chilenos)
  - `COP` -> `COL$` (Pesos Colombianos)
  - `MXN` -> `MX$` (Pesos Mexicanos)
  - `UYU` -> `$U` (Pesos Uruguayos)
  - `EUR` -> `€` (Euros)

## Security & Permissions
- Todas las rutas `/api/cashbox/*` están protegidas por `@login_required`.
- Las transacciones registran explícitamente `user_id = g.current_user_id`.
- Validación estricta de payloads: montos mayores a cero, validación de tipos numéricos y prevención de inyecciones o montos negativos en egresos (el egreso se registra con monto positivo y tipo `'egreso'`).

## ⚠️ High-Risk Files / Modules
- Módulo financiero (`app/backend/app/cashbox/`): impacto directo en la exactitud del dinero del taller. Cobertura de tests requerida del 100%.
- Migración de base de datos en tablas existentes `cash_movements` y `workshop_settings`.

## Impact on Data / Integraciones
- Base de datos MySQL: migración aditiva vía Alembic agregando columnas `description` a `cash_movements` y `currency_code`/`currency_symbol` a `workshop_settings`.
- Sin impacto en datos existentes (columnas con defaults y nullables).

## Schema Changes / Migrations
```sql
ALTER TABLE `workshop_settings`
  ADD COLUMN `currency_code` VARCHAR(3) NOT NULL DEFAULT 'ARS',
  ADD COLUMN `currency_symbol` VARCHAR(10) NOT NULL DEFAULT 'AR$';

ALTER TABLE `cash_movements`
  ADD COLUMN `description` VARCHAR(255) NULL;
```

## Decisions (Short ADR)
- **Decision:** No persistir el saldo de caja acumulativo en una columna, sino derivarlo on-read con `SUM()`.
  - **Discarded alternative:** Agregar una columna `current_balance` en `workshop_settings` o `cash_movements`.
  - **Reason:** Cumplimiento estricto de 3FN. Evita anomalías de concurrencia y desincronización si se elimina o corrige un registro.
- **Decision:** Permitir cobro de saldo tanto desde la vista de pedidos (al entregar) como desde el módulo de caja.
  - **Discarded alternative:** Exigir únicamente una de las dos vías.
  - **Reason:** Maximiza la flexibilidad operativa del taller (el operador puede entregar y cobrar en un click, o registrar el cobro después).
- **Decision:** Centralizar la configuración de moneda en `workshop_settings`.
  - **Discarded alternative:** Guardar la moneda por movimiento o en localStorage del navegador.
  - **Reason:** El taller tiene una moneda operativa unificada y consistente para todos los operadores y reportes.

---

## Inventory of Built Artifacts

### Database
- [ ] **Modify** table `workshop_settings` — agregar `currency_code`, `currency_symbol`.
- [ ] **Modify** table `cash_movements` — agregar `description`.

### Backend
- [ ] **Modify** `app.settings.models.WorkshopSettings` y `app.settings.routes` — soporte de campos de moneda.
- [ ] **Modify** `app.cashbox.models.CashMovement` — campo `description` y método `to_dict()`.
- [ ] **Create** `app.cashbox.services` — `create_movement`, `get_cash_summary`, `list_movements`, `get_order_balance_info`, `collect_order_balance`.
- [ ] **Create** `app.cashbox.routes` — endpoints REST para caja.
- [ ] **Modify** `app.orders.services` & `app.orders.routes` — integración con cobro de saldo al entregar.
- [ ] **Modify** `app.__init__` — registrar `cashbox_bp`.

### Frontend
- [ ] **Modify** `WorkshopSettingsView.jsx` — selector y configuración de moneda.
- [ ] **Create** `features/cashbox/cashboxApi.js` — cliente axios para caja.
- [ ] **Create** `features/cashbox/CashboxView.jsx` — dashboard de caja, métricas, modals de ingreso/egreso y tabla histórica.
- [ ] **Modify** `OrderBoard.jsx` — diálogo o acción rápida para cobrar saldo al entregar pedido listo.
- [ ] **Modify** `App.js` & `AppMenu.js` — ruta y menú para `/cashbox`.

### Tests
- [ ] **Create** `tests/cashbox/test_services.py` — pruebas unitarias de cálculo financiero y servicios.
- [ ] **Create** `tests/cashbox/test_routes.py` — pruebas de integración de endpoints REST de caja.
- [ ] **Create** `features/cashbox/CashboxView.test.js` — pruebas unitarias de componentes frontend.
- [ ] **Modify** `WorkshopSettingsView.test.js` — validación de selección de moneda.
