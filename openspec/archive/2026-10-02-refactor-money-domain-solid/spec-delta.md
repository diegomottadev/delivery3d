# Delta Specification: refactor-money-domain-solid

> Refactor sin cambio funcional. Los MODIFIED corrigen o precisan requisitos vivos para que coincidan con el comportamiento real (sirven de red de seguridad para el refactor); el único cambio de comportamiento es el rechazo cuando falta la categoría de sistema de un cobro automático.
> Los nombres entre `backticks` son campos del contrato HTTP, verificables por QA.

## ADDED Requirements

### Requirement: Costo por kg por defecto de un ítem (orders)
El sistema MUST asignar a un ítem de pedido el costo por kg informado en el ítem; si no se informa, el del material seleccionado; y si el ítem solo indica filamento (sin material ni costo), 18000.00.

#### Scenarios (SBE Example Matrix)
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-11 | Happy Path | Ítem con material de 18000.00 y costo informado 20000.00 | — | Alta de pedido | Costo por kg del ítem (`material_cost_per_kg`) = 20000.00 |
| EX-12 | Happy Path | Ítem con material de 25000.00, sin costo | — | Alta de pedido | Costo por kg del ítem = 25000.00 |
| EX-13 | Boundary | Ítem con filamento PLA (`filament_id`=1), sin material ni costo | — | Alta de pedido | Costo por kg del ítem = 18000.00 |
| EX-14 | Boundary | Ítem con filamento PLA, sin material ni costo | Pedido existente con otro ítem | Edición del pedido | Costo por kg del ítem = 18000.00 |
| EX-14c | Error Case | Ítem sin filamento ni material | — | Alta de pedido | 422, error en `items[0].filament_id` |

---

> **Bug corregido al cierre (2026-10-02):** un `material_cost_per_kg: 0` numérico se aceptaba (201) y tomaba 18000.00 por el patrón `x or y`. Ahora `schemas.py` y `_resolve_cost_per_kg` usan `is None`, y cualquier costo 0 (número o texto, en `material_cost_per_kg` o `cost_per_kg`) se rechaza con 422 en alta y edición. Tests: `test_intake.py::TestItemDefaultCostPerKg::test_zero_cost_per_kg_*`.

---

## MODIFIED Requirements

### Requirement: REQ-CASH-03 Cobro de Saldo de Pedidos (cashbox)
**Previous Behavior:**
El sistema calculaba el saldo pendiente como `precio_cotizado - sum(señas_previas)` (fórmula imprecisa: el código ya sumaba todos los ingresos del pedido, no solo señas).

**New Behavior:**
El sistema MUST calcular el saldo pendiente de un pedido como **precio informado − suma de todos los ingresos asociados al pedido**, con piso en 0, y MUST usar ese mismo valor al consultar el saldo, al cobrarlo desde caja y al cobrarlo en la entrega. Los egresos asociados al pedido no reducen lo cobrado.

| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | Precio informado 8000.00, seña 3000.00 | Pedido LISTO | Consultar saldo | Saldo pendiente (`pending_balance`) = 5000.00; total cobrado (`total_paid`) = 3000.00 |
| EX-02 | Happy Path | Igual a EX-01 | Pedido LISTO | Entregar con cobro de saldo sin indicar monto | Pedido ENTREGADO; ingreso `saldo_pedido` de 5000.00 |
| EX-03 | Happy Path | Igual a EX-01 | Pedido LISTO | Cobrar saldo desde caja sin indicar monto | 201; ingreso `saldo_pedido` de 5000.00 |
| EX-04 | Boundary | Precio 8000.00; seña 3000.00 + ingreso manual de 6000.00 asociado al pedido (total 9000.00) | Pedido LISTO | Consultar saldo | Saldo pendiente = 0.00 (nunca negativo) |
| EX-05 | Boundary | Pedido sin precio informado, sin ingresos | Pedido NUEVO | Consultar saldo | Precio informado (`informed_price`) = 0.00; saldo pendiente = 0.00 |
| EX-06 | Boundary | Precio 15000.00; un egreso de 2000.00 asociado al pedido | Pedido LISTO | Consultar saldo | Saldo pendiente = 15000.00 |

### Requirement: Order Lifecycle Transitions — cobros automáticos (orders)
**Previous Behavior:**
Al aprobar con seña > 0 (y al entregar con cobro de saldo > 0) el sistema creaba un ingreso con `category="seña"` (o `"saldo_pedido"`). Si la categoría correspondiente no existía en el catálogo, el ingreso se registraba igual, sin categoría vinculada.

**New Behavior:**
Al aprobar con seña > 0 y al entregar con cobro de saldo > 0, el sistema MUST registrar el ingreso vinculado a la **categoría de sistema** correspondiente (`seña` / `saldo_pedido`), con el pedido, el operador autenticado que hizo la transición y una descripción con el número de pedido. Solo cuenta una categoría marcada como de sistema y activa; una categoría creada por usuarios con nombre parecido NO la reemplaza. Si la categoría de sistema necesaria no está disponible, la transición MUST rechazarse con 409, sin cambiar el estado del pedido, sin registrar movimientos y sin agregar entradas al historial de estados.

> **Precondición de EX-15, EX-16 y EX-18:** la categoría de sistema se elimina o desactiva **directamente en la base de datos**; la API no permite hacerlo (las categorías de sistema no se pueden desactivar ni borrar).

| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-07 | Happy Path | Seña 1500.00 | Pedido PRESUPUESTADO | Aprobar (operador autenticado U) | 1 ingreso de 1500.00 vinculado a la categoría de sistema "Seña / Anticipo", usuario U, descripción "Seña inicial pedido #<id>" |
| EX-08 | Boundary | Seña 0.00 | Pedido PRESUPUESTADO | Aprobar | Pedido APROBADO; 0 movimientos |
| EX-09 | Happy Path | Precio 8000.00, seña 3000.00 | Pedido LISTO | Entregar con cobro de saldo (operador U) | Ingreso de 5000.00 vinculado a "Saldo de Pedido", usuario U, descripción "Cobro saldo entrega pedido #<id>" |
| EX-10 | Boundary | Precio 8000.00, seña 8000.00 | Pedido LISTO | Entregar con cobro de saldo sin monto | Pedido ENTREGADO; 0 ingresos `saldo_pedido` |
| EX-15 | Error Case | Seña 1500.00 | Categoría de sistema `seña` eliminada (DB); pedido PRESUPUESTADO | Aprobar | 409; `error` contiene `seña`; pedido sigue PRESUPUESTADO; 0 movimientos; 0 entradas nuevas en el historial |
| EX-16 | Error Case | Precio 8000.00, seña 3000.00 | Categoría de sistema `saldo_pedido` inactiva (DB); pedido LISTO | Entregar con cobro de saldo | 409; `error` contiene `saldo_pedido`; pedido sigue LISTO; 0 ingresos `saldo_pedido`; 0 entradas nuevas en el historial |
| EX-17 | Boundary | Seña 0.00 | Categoría de sistema `seña` eliminada (DB); pedido PRESUPUESTADO | Aprobar | 200; pedido APROBADO (no se necesita la categoría) |
| EX-18 | Error Case | Seña 1500.00 | Categoría de sistema `seña` eliminada (DB) y existe una categoría de usuario `code="anticipo_cliente"`, nombre "seña"; pedido PRESUPUESTADO | Aprobar | 409; pedido sigue PRESUPUESTADO; 0 movimientos (no se vincula a la categoría de usuario) |

---

## SBE Quality Checklist (Gojko Adzic Principles)
- [x] **Pure Domain Language:** pedidos, señas, saldos, categorías; los campos HTTP van acompañados del término de negocio.
- [x] **The Tester Test:** cada fila se verifica por API; las precondiciones que exigen tocar la base están señaladas.
- [x] **Concrete Example Table:** happy path, bordes (saldo 0, sobrepago, sin precio, egreso) y errores.
- [x] **Atomicity:** un requisito por regla (costo por defecto, saldo, cobros automáticos).
