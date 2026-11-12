# Proposal: weight-three-decimals

- **Domain:** `orders` (folder in `openspec/specs/orders/`)
- **Reference Ticket / Issue:** User Request - Soporte para 3 decimales en input y tabla de Peso (g)

## Why
En la impresión 3D (especialmente con slicers como Bambu Studio), el peso estimado de piezas pequeñas o impresiones de precisión con boquillas finas se calcula frecuentemente con 3 cifras decimales (miligramos, ej. `12.345 g` o piezas livianas de menos de 1 gramo como `0.785 g`). 
Anteriormente:
1. El input de peso en `OrderIntakeForm` limitaba a `maxFractionDigits={2}` y `min={0.1}`, impidiendo ingresar o visualizar el tercer decimal.
2. La base de datos (`order_items.weight_g`) utilizaba `DECIMAL(8, 2)`, truncando o redondeando cualquier valor a dos decimales y perdiendo precisión en el pesaje del laminador.

## What Changes
1. **Frontend Input:** Actualizar el componente `InputNumber` de peso en `OrderIntakeForm.jsx` para admitir hasta 3 decimales después de la coma (`maxFractionDigits={3}`, `min={0.001}` y `minFractionDigits={0}`).
2. **Base de Datos & Modelo:**
   - Migración Alembic para alterar la columna `order_items.weight_g` de `DECIMAL(8, 2)` a `DECIMAL(10, 3)`.
   - Actualización del modelo SQLAlchemy `OrderItem.weight_g` a `Numeric(10, 3)`.
3. **Visualización en Tablas y Desgloses:** Asegurar que las tablas de pedidos (`OrderList`), tarjetas (`OrderBoard`) y desglose de cotización (`QuoteModal`) muestren el peso con precisión de hasta 3 decimales sin redondeos forzados.

## Capabilities
- **New capabilities:**
  - El operador puede ingresar pesos con hasta 3 decimales (miligramos, ej. `50.125 g`, `0.750 g`).
  - La base de datos y la API almacenan y retornan la precisión completa de 3 decimales en `weight_g`.
- **Modified capabilities:**
  - El campo `weight_g` permite un límite inferior de `0.001 g` en lugar de `0.1 g`.
- **Removed capabilities:**
  - Ninguna.

## Out of Scope
- Modificar la precisión de otros campos monetarios (`DECIMAL(10, 2)` se mantiene estricto para dinero según las reglas de negocio).
