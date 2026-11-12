# User Stories (INVEST & SBE): quote-calculation

---

## User Story: US-01 — Cálculo automático de costo y precio sugerido

**As a** operador/dueño del taller
**I want** cargar las variables del laminador y del taller para un pedido y obtener automáticamente el costo de producción y el precio de venta sugerido
**So that** deje de depender de una calculadora externa y evite errores manuales que afectan la rentabilidad

### INVEST Evaluation
- **I**ndependent: Depende de `order-intake` (el pedido debe existir en `NEW`), pero es una capacidad propia y acotada.
- **N**egotiable: Los nombres exactos de las variables de entrada son ajustables sin cambiar el valor de negocio.
- **V**aluable: Estandariza y agiliza la cotización, evitando errores que afectan directamente el margen del taller.
- **E**stimable: Fórmula cerrada y documentada en `design.md`, sin ambigüedad de cálculo.
- **S**mall: Un único endpoint de cálculo, función pura testeable de forma aislada.
- **T**estable: Cada escenario en `spec-delta.md` tiene un resultado numérico exacto verificable.

---

### Acceptance Criteria (Given-When-Then)

#### Scenario 1: Cálculo exitoso
- **GIVEN** un pedido en estado `Nuevo / Por cotizar` con todas sus variables de laminador y taller
- **WHEN** el operador solicita el cálculo de cotización
- **THEN** el sistema devuelve `production_cost` y `suggested_sale_price` calculados según la fórmula, sin cambiar el estado del pedido

#### Scenario 2: Margen y desperdicio en cero (boundary)
- **GIVEN** un pedido con `waste_purge_pct=0` y `profit_margin_pct=0`
- **WHEN** se calcula la cotización
- **THEN** `suggested_sale_price` es exactamente igual a `production_cost`

#### Scenario 3: Variable negativa rechazada
- **GIVEN** un pedido con `filament_weight_g` negativo
- **WHEN** se solicita el cálculo
- **THEN** el sistema rechaza la solicitud con `422 Unprocessable Entity` y no persiste ningún valor

---

### Example Mapping Table
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | weight=120g, waste=5%, filament=$18000/kg, time=210min, power=120W, kwh=$150, amort=$300/h, labor=$1500, margin=40% | Pedido #101, `NEW` | `POST /api/orders/101/quote` | 200 OK; `production_cost=4881.00`, `suggested_sale_price=6833.40` |
| EX-02 | Boundary | waste=0%, margin=0%, weight=100g, filament=$20000/kg, time=60min, power=100W, kwh=$100, amort=$200/h, labor=$500 | Pedido #102, `NEW` | `POST /api/orders/102/quote` | 200 OK; `production_cost=2710.00 = suggested_sale_price` |
| EX-03 | Error Case | `filament_weight_g=-50.00` | Pedido #104, `NEW` | `POST /api/orders/104/quote` | 422 Unprocessable Entity |

---

## User Story: US-02 — Confirmar precio informado y pasar a "Presupuestado"

**As a** operador/dueño del taller
**I want** registrar el valor final que le informé al cliente y que el pedido avance automáticamente a "Presupuestado"
**So that** quede claro qué pedidos ya fueron cotizados y comunicados, distinguiéndolos de los que solo tengo un cálculo preliminar

### INVEST Evaluation
- **I**ndependent: Depende de US-01 (debe existir un cálculo previo), pero es una acción de negocio separada (confirmar ≠ calcular).
- **N**egotiable: La relación entre `suggested_sale_price` e `informed_price` (si deben coincidir) es discrecional del operador.
- **V**aluable: Marca el punto de compromiso con el cliente y habilita el resto del ciclo de vida (`order-lifecycle`).
- **E**stimable: Una transición de estado simple con una validación de precondición.
- **S**mall: Un único endpoint, una única transición (`NEW → QUOTED`).
- **T**estable: Estado resultante y fila de historial son directamente verificables.

---

### Acceptance Criteria (Given-When-Then)

#### Scenario 1: Confirmación exitosa
- **GIVEN** un pedido `NEW` con un cálculo de cotización previo
- **WHEN** el operador confirma un `informed_price` positivo
- **THEN** el pedido pasa a `Presupuestado` (`QUOTED`), se registra `quoted_at` y se agrega una fila al historial `NEW→QUOTED`

#### Scenario 2: Precio igual a cero (boundary)
- **GIVEN** un pedido `NEW` con cálculo previo
- **WHEN** el operador intenta confirmar `informed_price=0.00`
- **THEN** el sistema rechaza la solicitud con `422 Unprocessable Entity` y el pedido permanece `NEW`

#### Scenario 3: Reconfirmación de un pedido ya presupuestado
- **GIVEN** un pedido ya en estado `QUOTED`
- **WHEN** el operador intenta confirmar un nuevo precio
- **THEN** el sistema rechaza la solicitud con `409 Conflict` y no se altera el `informed_price` existente

---

### Example Mapping Table
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | `informed_price=6800.00` | Pedido #101, `NEW`, con cálculo previo | `POST /api/orders/101/quote/confirm` | 200 OK; `status=QUOTED`; historial `NEW→QUOTED` |
| EX-02 | Boundary | `informed_price=0.00` | Pedido #108, `NEW`, con cálculo previo | `POST /api/orders/108/quote/confirm` | 422 Unprocessable Entity |
| EX-03 | Error Case | `informed_price=7000.00` | Pedido #111, ya `QUOTED` | `POST /api/orders/111/quote/confirm` | 409 Conflict |
