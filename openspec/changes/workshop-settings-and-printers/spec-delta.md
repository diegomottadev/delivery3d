# Delta Specification: workshop-settings-and-printers

## ADDED Requirements

### Requirement: Workshop Default Settings Management
El sistema DEBE permitir a los operadores autenticados consultar y actualizar las constantes operativas globales del taller mediante la entidad `workshop_settings`.
- Los parámetros incluyen: `kwh_cost`, `waste_purge_pct`, `labor_cost_per_hour`, `default_labor_time_minutes`, `profit_multiplier` y `default_printer_id`.
- Todos los costos y tiempos DEBEN ser números no negativos (`>= 0`).
- El multiplicador de ganancia DEBE ser `>= 1`.

### Requirement: Printer Catalog Management
El sistema DEBE permitir registrar, listar y actualizar impresoras 3D mediante la entidad `printers`.
- Cada impresora DEBE contar con nombre único, modelo opcional, potencia en Watts (`power_watts > 0`), costo de amortización por hora (`cost_per_hour >= 0`) y estado activo/inactivo (`is_active`).

---

## MODIFIED Requirements

### Requirement: Quote Calculation & Confirmation
**Previous Behavior:**
La cotización requería ingresar `labor_cost` como un monto global fijo o plano por orden, y la potencia/amortización eran fijas para la máquina Bambu Lab A1.

**New Behavior:**
El sistema DEBE permitir seleccionar una impresora del catálogo (`printer_id`) para cargar dinámicamente su potencia y amortización horaria. Asimismo, el cálculo de costo de mano de obra DEBE realizarse mediante la tarifa horaria del operador y la duración en minutos del trabajo humano:
$$\text{labor\_cost} = \text{round}\left(\text{labor\_cost\_per\_hour} \times \frac{\text{labor\_time\_minutes}}{60}\right)$$
Los valores predeterminados se precargan desde `workshop_settings` pero son editables por cotización. Se persisten `labor_cost_per_hour` y `labor_time_minutes` atómicamente en `order_quotes`.

---

## SBE Quality Checklist (Gojko Adzic Principles)
- [x] **Pure Domain Language:** Declarado en reglas de negocio y fórmulas matemáticas, libre de acoplamientos técnicos de framework.
- [x] **The Tester Test:** Permite a QA verificar el cumplimiento funcional y los códigos de error HTTP de manera objetiva.
- [x] **Concrete Example Table:** Casos felices con fórmulas reales (ej. 15m @ $650/h = $162.50) y casos límite/error.
- [x] **Atomicity:** Cada requerimiento modela una responsabilidad de negocio concreta.
