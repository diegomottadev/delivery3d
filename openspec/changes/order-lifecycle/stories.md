# User Stories (INVEST & SBE): order-lifecycle

---

## User Story: US-01 — Aprobar un pedido presupuestado con seña opcional

**As a** operador/dueño del taller
**I want** marcar un pedido presupuestado como aprobado cuando el cliente confirma, registrando opcionalmente el monto de seña recibido
**So that** sepa qué pedidos ya están confirmados y en cola de producción, y quede un dato de referencia del anticipo sin mezclarlo con la caja real

### INVEST Evaluation
- **I**ndependent: Depende de `quote-calculation` (el pedido debe estar `QUOTED`), pero la transición en sí es una capacidad propia.
- **N**egotiable: El límite superior del monto de seña queda abierto (Red Card RC-1).
- **V**aluable: Marca el compromiso real del cliente y habilita la cola de producción.
- **E**stimable: Una transición de estado con un campo opcional.
- **S**mall: Un único endpoint, una única transición (`QUOTED → APPROVED`).
- **T**estable: Estado resultante, campo `deposit_amount` y fila de historial son verificables directamente.

### Acceptance Criteria (Given-When-Then)

#### Scenario 1: Aprobación sin seña
- **GIVEN** un pedido `Presupuestado`
- **WHEN** el operador lo aprueba sin indicar monto de seña
- **THEN** el pedido pasa a `Aprobado / En cola` con `deposit_amount=null` y se registra la transición en el historial

#### Scenario 2: Aprobación con seña (boundary)
- **GIVEN** un pedido `Presupuestado`
- **WHEN** el operador lo aprueba con `deposit_amount=0.00`
- **THEN** el pedido pasa a `Aprobado / En cola` con `deposit_amount=0.00` (valor explícito distinto de `null`)

#### Scenario 3: Salto de estado inválido
- **GIVEN** un pedido en `Imprimiendo`
- **WHEN** el operador intenta "aprobarlo"
- **THEN** el sistema rechaza la solicitud con `409 Conflict` y el estado no cambia

### Example Mapping Table
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | sin `deposit_amount` | Pedido #101, `QUOTED` | `POST /api/orders/101/approve` | 200 OK; `status=APPROVED`, `deposit_amount=null` |
| EX-02 | Boundary | `deposit_amount=0.00` | Pedido #103, `QUOTED` | `POST /api/orders/103/approve` | 200 OK; `deposit_amount=0.00` |
| EX-03 | Error Case | `deposit_amount=-0.01` | Pedido #105, `QUOTED` | `POST /api/orders/105/approve` | 422 Unprocessable Entity |

---

## User Story: US-02 — Avanzar el pedido por producción y entrega

**As a** operador/dueño del taller
**I want** marcar un pedido aprobado como "imprimiendo", luego "listo" y finalmente "entregado/cobrado", en ese orden estricto
**So that** el tablero operativo refleje en todo momento el estado real de producción de cada pedido

### INVEST Evaluation
- **I**ndependent: Depende de US-01 (el pedido debe estar `APPROVED`), pero las 3 transiciones forman una única progresión de negocio coherente.
- **N**egotiable: Los nombres exactos de los endpoints son detalle técnico ajustable.
- **V**aluable: Da visibilidad operativa completa del pipeline de producción, objetivo central del panel izquierdo del dashboard.
- **E**stimable: Tres transiciones simétricas sobre el mismo mecanismo de `state_machine.py`.
- **S**mall: Reutiliza el mismo patrón de validación para las tres transiciones.
- **T**estable: Cada transición válida/inválida tiene un resultado HTTP y de estado exacto.

### Acceptance Criteria (Given-When-Then)

#### Scenario 1: Progresión completa válida
- **GIVEN** un pedido `Aprobado / En cola`
- **WHEN** el operador lo avanza secuencialmente a `Imprimiendo`, luego `Listo`, luego `Entregado / Cobrado`
- **THEN** cada transición se acepta en orden y queda registrada en el historial

#### Scenario 2: Estado terminal
- **GIVEN** un pedido ya `Entregado / Cobrado`
- **WHEN** el operador intenta aplicar cualquier transición sobre él
- **THEN** el sistema rechaza la solicitud con `409 Conflict` en todos los casos

#### Scenario 3: Salto de estado (skip)
- **GIVEN** un pedido `Aprobado / En cola`
- **WHEN** el operador intenta marcarlo directamente como `Listo` (saltando `Imprimiendo`)
- **THEN** el sistema rechaza la solicitud con `409 Conflict` y el estado no cambia

### Example Mapping Table
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | — | Pedido #201, `APPROVED` | `POST /api/orders/201/start-printing` | 200 OK; `status=PRINTING` |
| EX-02 | Happy Path | — | Pedido #301, `PRINTING` | `POST /api/orders/301/mark-ready` | 200 OK; `status=READY` |
| EX-03 | Error Case | Salto `APPROVED→READY` | Pedido #302, `APPROVED` | `POST /api/orders/302/mark-ready` | 409 Conflict |

---

## User Story: US-03 — Consultar estado actual e historial de un pedido

**As a** operador/dueño del taller
**I want** ver en cualquier momento el estado actual de un pedido y todas sus transiciones anteriores
**So that** pueda responder rápido a un cliente que pregunta por su pedido, sin depender de la memoria

### INVEST Evaluation
- **I**ndependent: Solo depende de que existan pedidos con historial (de cualquier change previo).
- **N**egotiable: El formato exacto de la respuesta es ajustable.
- **V**aluable: Cierra el objetivo de trazabilidad completa declarado en `Project.md` §1.
- **E**stimable: Un endpoint de solo lectura sobre datos ya persistidos.
- **S**mall: Sin lógica de negocio adicional.
- **T**estable: Cantidad y orden de las entradas del historial son verificables.

### Acceptance Criteria (Given-When-Then)

#### Scenario 1: Historial completo de un pedido en progreso
- **GIVEN** un pedido que pasó por `QUOTED→APPROVED→PRINTING`
- **WHEN** el operador consulta su historial
- **THEN** recibe exactamente 3 entradas en orden cronológico ascendente, cada una con actor y timestamp

#### Scenario 2: Pedido recién presupuestado (boundary)
- **GIVEN** un pedido que solo tiene la entrada inicial de historial (de `quote-calculation`)
- **WHEN** se consulta su historial
- **THEN** recibe exactamente 1 entrada, nunca un array vacío

#### Scenario 3: Pedido inexistente
- **GIVEN** un `order_id` que no existe
- **WHEN** se solicita su historial
- **THEN** el sistema responde `404 Not Found`

### Example Mapping Table
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | Pedido #501 con 3 transiciones | `PRINTING` | `GET /api/orders/501/history` | 200 OK; 3 entradas ordenadas |
| EX-02 | Boundary | Pedido #502 con 1 transición inicial | `QUOTED` | `GET /api/orders/502/history` | 200 OK; 1 entrada |
| EX-03 | Error Case | `order_id=9999` inexistente | n/a | `GET /api/orders/9999/history` | 404 Not Found |
