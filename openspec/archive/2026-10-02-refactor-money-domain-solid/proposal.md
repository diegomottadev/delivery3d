# Proposal: refactor-money-domain-solid

- **Domain:** `cashbox` + `orders` (folders in `openspec/specs/cashbox/` y `openspec/specs/orders/`)
- **Reference Ticket / Issue:** Revisión SOLID/CUPID de `orders/services.py`, `cashbox/services.py` y `orders/pricing.py` (2026-10-01). Bugs derivados ya corregidos fuera de este change: validación de `final_payment_amount`, rechazo de NaN/sNaN y de montos con más de 2 decimales.
- **Depth:** alpha
- **Status:** done

## Why
Las reglas de dinero viven duplicadas en varios lugares y las copias ya divergieron una vez (el cobro al entregar no validaba el monto mientras que `collect-balance` sí). Hoy:
1. El **saldo pendiente** de un pedido se calcula en dos funciones distintas (`cashbox/services.py::get_order_balance_info` y `orders/services.py::_pending_balance`).
2. Los **movimientos automáticos** de seña (al aprobar) y saldo (al entregar) se construyen a mano en `orders/services.py`, sin pasar por las validaciones de caja, porque `create_movement` hace `commit` interno y no se puede usar dentro de la transacción de la transición. Si la categoría de sistema faltara, el movimiento queda sin categoría y nadie se entera.
3. `collect_order_balance` reconvierte a `Decimal` un saldo que ya pasó por `float`.
4. Constantes de dinero repetidas: `DECIMAL_10_2_MAX` (2 copias), costo por kg por defecto `18000.00` (3 copias sin nombre).
5. El armado de ítems de pedido está copiado entre `create_order` y `update_order` (~30 líneas).

Si no se hace nada, el próximo cambio en cualquiera de estas reglas (p. ej. descontar devoluciones del saldo) se aplicará en una sola copia y la otra quedará desincronizada en silencio.

## What Changes
Refactor interno con una única fuente de verdad para cada regla de dinero. La API HTTP, los códigos de estado y los cuerpos de respuesta no cambian. Única diferencia observable, deliberada: si la categoría de sistema (`seña`/`saldo_pedido`) no existe, está inactiva o no está marcada como de sistema, la transición que necesita registrar ese cobro se rechaza en lugar de guardar un movimiento sin categoría.

## Capabilities
- **New capabilities:** ninguna.
- **Modified capabilities:**
  - La aprobación con seña y la entrega con cobro de saldo exigen que su categoría de sistema exista y esté activa (hoy está garantizado por la migración `411d9c4af9cc`; la diferencia solo se observa con datos corrompidos a mano).
- **Removed capabilities:** ninguna.

## Out of Scope
- Mapa `TRANSITION_EFFECTS` para efectos por estado en `transition_order` (seguimiento posible).
- Unificar el CRUD de categorías de ingreso/egreso en `cashbox/services.py`.
- Quitar el valor por defecto `user_id=1` de `create_movement`.
- Dividir `compute_quote` en `pricing.py` (solo se le cambia el import de `DECIMAL_10_2_MAX`).
- Cualquier cambio de frontend, rutas, esquema de base de datos o migraciones.
- Unificar el idioma de los mensajes de error (inglés en orders, español en cashbox).
