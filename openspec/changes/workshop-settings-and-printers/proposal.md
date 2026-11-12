# Proposal: workshop-settings-and-printers

- **Domain:** `settings` / `orders`
- **Reference Ticket / Issue:** User Request - Constantes de Taller, Impresoras y Mano de Obra por Horas/Minutos

## Why
El taller de impresión 3D requiere manejar valores constantes predeterminados (costo del kWh de electricidad a $278.00, merma/purga al 10%, margen multiplicador, tarifa de mano de obra y tiempo humano de preparación). Anteriormente, estos valores estaban fijos en el código o requerían ingreso manual repetitivo en cada cotización. Además:
1. La potencia eléctrica y la amortización dependen del modelo de impresora utilizado (ej. Bambu Lab A1 vs P1S vs Ender 3).
2. La mano de obra del operador se rige por una tarifa por hora y un tiempo específico de trabajo humano (horas y minutos), completamente independiente del tiempo de impresión de la máquina (ej. 15 minutos = 0.25 h @ $650/h = $162.50).

Sin este cambio, el operador pierde tiempo reescribiendo valores, comete errores de cálculo de mano de obra y no cuenta con flexibilidad para cambiar de impresora o actualizar costos operativos globales.

## What Changes
1. **Entidad `workshop_settings`:** Tabla normalizada (1FN a 4FN) con id único para almacenar los parámetros por defecto del taller (`kwh_cost`, `waste_purge_pct`, `labor_cost_per_hour`, `default_labor_time_minutes`, `profit_multiplier`, `default_printer_id`).
2. **Entidad `printers`:** Tabla normalizada de impresoras disponibles con atributos atómicos (`name`, `model`, `power_watts`, `cost_per_hour`, `is_active`).
3. **Cálculo de Cotización (`orders`):**
   - Incorporación de `printer_id` opcional en la cotización.
   - Nueva fórmula de mano de obra: `labor_cost = labor_cost_per_hour * (labor_time_minutes / 60)`.
   - Persistencia atómica de `labor_cost_per_hour` y `labor_time_minutes` en `order_quotes`.
   - Cálculo on-read de costos y precio sugerido (estricta 3FN).
4. **Vistas Frontend:**
   - Nueva vista `/settings` (`WorkshopSettingsView.jsx`) para administrar constantes globales del taller y CRUD de impresoras.
   - En `QuoteModal.jsx`: selector dinámico de impresora (precarga potencia y amortización), tarifa horaria monetaria, inputs separados para horas y minutos con flechas (`showButtons`), y cálculo reactivo visible en tiempo real.

## Capabilities
- **New capabilities:**
  - Configurar y persistir las constantes operativas del taller (`GET`, `PUT /api/settings`).
  - Crear, listar y editar impresoras del taller (`GET`, `POST`, `PUT /api/printers`).
  - Seleccionar impresora en la cotización para sincronizar automáticamente potencia en Watts y amortización por hora.
  - Asignar tiempo de mano de obra en horas y minutos independientes del tiempo de máquina.
- **Modified capabilities:**
  - `compute_quote` calcula la mano de obra proporcional al tiempo humano exacto ingresado en lugar de usar un monto fijo estático.
  - La cotización se pre-llena con las constantes de `workshop_settings` pero permite al operador ajustar los valores libremente por pedido.
- **Removed capabilities:**
  - Ninguna funcionalidad previa eliminada; retrocompatibilidad total con pedidos cotizados anteriormente.

## Out of Scope
- Gestión multi-taller / multi-inquilino (sistema pensado para un taller).
- Conexión por protocolo MQTT/LAN directa con las impresoras Bambu Lab.
