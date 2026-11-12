# Proposal: cashbox-management

- **Domain:** `cashbox` (folder in `openspec/specs/cashbox/`)
- **Reference Ticket / Issue:** Project.md §4, §5

## Why
Actualmente el sistema registra la seña de un pedido al pasar al estado `aprobado` mediante una inserción directa en la tabla `cash_movements`, pero no provee ningún endpoint ni servicio para:
1. Registrar egresos operativos del taller (compra de bobinas de filamento PLA/PETG, repuestos para la Bambu Lab A1 como nozzles o placas PEI, consumo de servicios, empaque).
2. Registrar ingresos extraordinarios o cobros de saldo pendiente al momento de entregar un pedido (`precio cotizado - seña`).
3. Conocer el balance neto disponible en tiempo real (`total_ingresos - total_egresos`).
4. Visualizar el historial cronológico y auditable de movimientos de caja.
5. Configurar la moneda del taller (por defecto `AR$` / `ARS` para Argentina, pero configurable para cualquier país de Latinoamérica o divisa como `USD`, `CLP`, `COP`, `MXN`, `UYU`).

Sin este módulo, el taller no tiene control del flujo de fondos, desconoce si los ingresos cubren los costos operativos y debe llevar el saldo en libretas o planillas externas.

## What Changes
1. **Configuración de Moneda Global (`workshop_settings`):**
   - Incorporación de `currency_code` (VARCHAR(3), default `'ARS'`) y `currency_symbol` (VARCHAR(10), default `'AR$'`) en la configuración del taller.
   - Selector intuitivo en la interfaz de configuración del taller con opciones predefinidas de Latinoamérica y posibilidad de personalización.
   - Reflejo consistente del símbolo de moneda en todas las vistas financieras y cotizaciones.

2. **Servicios y Endpoints de Caja (`/api/cashbox`):**
   - Servicio de registro de movimientos (`ingreso` y `egreso`) con categorización, descripción textual detallada, validación de montos positivos y vinculación opcional a un `order_id`.
   - Consulta de resumen financiero dinámico on-read: `total_ingresos`, `total_egresos` y `current_balance` cumpliendo 3FN sin columnas calculadas redundantes.
   - Listado cronológico de movimientos con filtros por tipo, categoría y orden.
   - Servicio y endpoint específico para cobro de saldo final pendiente de un pedido (`POST /api/cashbox/orders/<order_id>/collect-balance`) y soporte en la acción de entrega del pedido.

3. **Interfaz de Usuario de Caja Diaria y Finanzas:**
   - Vista dedicada `/cashbox` accesible desde el menú principal con métricas de caja (Saldo actual, Total Ingresos, Total Egresos), botones rápidos para registrar ingresos/egresos y tabla de movimientos cronológicos.
   - Integración fluida en el Tablero de Pedidos (`OrderBoard`): al entregar un pedido listo con saldo pendiente, permitir cobrar el saldo restante con un solo clic.

## Capabilities
- **New capabilities:**
  - Configurar código y símbolo de moneda del taller (`currency_code`, `currency_symbol`).
  - Registrar egresos clasificados (filamento, repuestos Bambu A1, servicios, embalaje, otros) con descripción y monto.
  - Registrar ingresos extraordinarios independientes de pedidos.
  - Cobrar saldo pendiente de un pedido con un solo clic al entregar o desde la gestión de caja.
  - Consultar en tiempo real el balance neto de caja y el desglose de ingresos y egresos.
  - Auditar la trazabilidad de cada movimiento (fecha/hora, usuario operador, pedido asociado, categoría y notas).
- **Modified capabilities:**
  - `workshop_settings`: ampliado para persistir y retornar configuración de moneda.
  - `CashMovement`: ampliado con columna `description` para notas legibles de cada transacción.
  - `OrderBoard`: soporte para cobro directo de saldo final al completar entregas.
- **Removed capabilities:**
  - Ninguna.

## Out of Scope
- Gestión de cuentas bancarias múltiples o pasarelas de pago automatizadas (Mercado Pago, Stripe).
- Conciliación bancaria automática o facturación electrónica AFIP.
- Cierres de caja ciegos con arqueo físico formal por turnos múltiples (el modelo actual es caja continua de taller unificado).
