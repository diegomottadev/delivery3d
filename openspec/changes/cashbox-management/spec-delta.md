# Spec Delta: cashbox-management

## Domain: `settings` (openspec/specs/settings/spec.md)

### MODIFIED Requirements

#### REQ-SET-01: Global Workshop Constants Entity
- **Previous:** `workshop_settings` almacena costos operativos, porcentajes de purga, mano de obra e impresora predeterminada.
- **Updated:** `workshop_settings` incorpora además los atributos `currency_code` (VARCHAR(3), NOT NULL, default `'ARS'`) y `currency_symbol` (VARCHAR(10), NOT NULL, default `'AR$'`) para soportar la configuración de moneda de Argentina u otros países latinoamericanos/internacionales.

---

## Domain: `cashbox` (openspec/specs/cashbox/spec.md)

### ADDED Requirements

#### REQ-CASH-01: Cash Movements Entity with Detailed Description
- La tabla `cash_movements` almacena cada movimiento financiero con atributos atómicos: `id` (PK), `type` (ENUM/VARCHAR `'ingreso'`, `'egreso'`), `amount` (DECIMAL(10,2), CHECK > 0), `category` (VARCHAR(60)), `description` (VARCHAR(255), NULL), `order_id` (FK a `orders.id`, ON DELETE SET NULL, NULL), `user_id` (FK a `users.id`, NOT NULL), y `created_at` (DATETIME UTC).

#### REQ-CASH-02: Real-time Dynamic Balance Calculation (3FN)
- El balance de caja nunca se persiste en campos redundantes. Se calcula en tiempo real evaluando:
  `current_balance = SUM(amount WHERE type = 'ingreso') - SUM(amount WHERE type = 'egreso')`.
- Los endpoints financieros exponen `total_ingresos`, `total_egresos`, `current_balance`, y la moneda configurada (`currency_code`, `currency_symbol`).

#### REQ-CASH-03: Operational Expenses and Extraordinary Income Recording
- Los operadores autenticados pueden registrar egresos categorizados (filamento, repuestos Bambu A1, servicios, insumos) e ingresos extraordinarios independientes de pedidos.

#### REQ-CASH-04: Order Balance Settlement
- Los pedidos con saldo adeudado (`precio_cotizado - señas_ingresadas > 0`) pueden liquidar su saldo pendiente registrando automáticamente un movimiento de tipo `ingreso` con categoría `'saldo_pedido'` asociado a la orden.

#### REQ-CASH-05: Cashbox User Interface & Order Integration
- La aplicación provee una vista `/cashbox` con tarjetas de resumen financiero, modales de ingreso y egreso rápido, y tabla cronológica de transacciones.
- El tablero de órdenes (`OrderBoard`) integra la opción de registrar la cobranza del saldo pendiente en el flujo de entrega.
