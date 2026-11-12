# User Stories (INVEST & SBE): order-intake

---

## User Story: US-01 — Alta manual de un pedido

**As a** operador/dueño del taller
**I want** registrar manualmente un nuevo pedido con los datos básicos del prospecto
**So that** no pierda información de clientes que llegan por WhatsApp o Instagram DM y tenga un registro central en vez de notas dispersas

### INVEST Evaluation
- **I**ndependent: No depende de otro change; es la base fundacional del dominio `orders`.
- **N**egotiable: Los campos exactos (ej. si `reference_url` es obligatorio) pueden ajustarse sin cambiar el valor de negocio central.
- **V**aluable: Elimina la pérdida de pedidos y datos de clientes — el problema #1 declarado en `Project.md` §1.
- **E**stimable: Alcance acotado a un CRUD simple de creación + listado sobre una entidad nueva.
- **S**mall: Entregable en un único ciclo TDD (Red → Green → Refactor).
- **T**estable: Cada campo y su validación tienen un criterio de aceptación verificable (ver AC-1 a AC-8 en `spec-delta.md`).

---

### Acceptance Criteria (Given-When-Then)

#### Scenario 1: Alta exitosa de un pedido
- **GIVEN** un operador autenticado
- **WHEN** envía `customer_name`, `contact`, `piece_description` y `reference_url` válidos
- **THEN** el sistema crea el pedido en estado `Nuevo / Por cotizar` y devuelve `201 Created` con el `id` generado

#### Scenario 2: Datos obligatorios faltantes
- **GIVEN** un operador autenticado
- **WHEN** envía el formulario sin `customer_name` o con espacios en blanco
- **THEN** el sistema rechaza la solicitud con `422 Unprocessable Entity` y no crea ningún registro

#### Scenario 3: Acceso no autenticado
- **GIVEN** un usuario sin token JWT válido
- **WHEN** intenta dar de alta un pedido
- **THEN** el sistema responde `401 Unauthorized` y no crea ningún registro

---

### Example Mapping Table
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | customer_name="Maria Fernandez", contact="WhatsApp +54 9 11 5555-1234", piece_description="Soporte de auricular" | Operador autenticado | `POST /api/orders` | 201 Created; pedido en estado `NEW` |
| EX-02 | Boundary | `customer_name` de 120 caracteres (límite exacto) | Operador autenticado | `POST /api/orders` | 201 Created; se persiste completo |
| EX-03 | Error Case | `customer_name` vacío | Operador autenticado | `POST /api/orders` | 422 Unprocessable Entity |

---

## User Story: US-02 — Trazabilidad de la creación del pedido

**As a** operador/dueño del taller
**I want** que quede registrado quién y cuándo dio de alta cada pedido
**So that** pueda reconstruir el historial completo de un pedido si hace falta, cumpliendo el objetivo de "trazabilidad completa" del proyecto

### INVEST Evaluation
- **I**ndependent: Se apoya en US-01 (requiere que el pedido exista) pero es un mecanismo transversal reutilizado por los changes `quote-calculation` y `order-lifecycle`.
- **N**egotiable: El nivel de detalle del historial (solo estado o también notas) es ajustable.
- **V**aluable: Sienta la base de auditoría que sostiene todo el ciclo de vida del pedido.
- **E**stimable: Una tabla simple (`order_status_history`) con una fila por transición.
- **S**mall: Se implementa junto con US-01 en la misma transacción de creación.
- **T**estable: Verificable contando filas de historial tras cada alta.

---

### Acceptance Criteria (Given-When-Then)

#### Scenario 1: Historial creado junto al pedido
- **GIVEN** un pedido recién creado
- **WHEN** se consulta su historial de estados
- **THEN** existe exactamente 1 fila con `from_status=NULL`, `to_status='NEW'`, el operador y el timestamp de creación

#### Scenario 2: Atomicidad ante fallo
- **GIVEN** una creación de pedido que falla por una violación de restricción de base de datos
- **WHEN** se intenta persistir el pedido
- **THEN** ni el pedido ni la fila de historial quedan guardados (rollback completo)

#### Scenario 3: Identidad del operador ausente
- **GIVEN** un intento de creación sin una identidad de operador resoluble
- **WHEN** se ejecuta `create_order()`
- **THEN** la operación se rechaza (no se permite `changed_by NULL`)

---

### Example Mapping Table
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | Pedido `id=57`, `created_by=8` | Pedido no existe | Creación exitosa | 1 fila en `order_status_history` (`NULL→NEW`) |
| EX-02 | Boundary | Pedido recién creado | Historial consultado inmediatamente | Consulta interna | Exactamente 1 fila, nunca 0 ni más de 1 |
| EX-03 | Error Case | Falla de escritura en la inserción del pedido | Transacción en curso | Insert falla | Rollback completo; ningún registro persistido |

---

## User Story: US-03 — Consulta de pedidos existentes

**As a** operador/dueño del taller
**I want** listar y consultar los pedidos ya registrados con su estado actual
**So that** pueda revisar en cualquier momento qué prospectos tengo, sin depender de la memoria o de chats dispersos

### INVEST Evaluation
- **I**ndependent: Depende únicamente de que existan pedidos creados por US-01.
- **N**egotiable: Paginación/orden son detalles de implementación abiertos (Red Card #4 en `spec-delta.md`).
- **V**aluable: Da visibilidad inmediata del estado operativo — condición necesaria para el dashboard (`Project.md` §5).
- **E**stimable: Dos endpoints de solo lectura sobre una tabla ya definida.
- **S**mall: Sin lógica de negocio adicional más allá de serializar y devolver.
- **T**estable: Respuestas HTTP y payloads son directamente verificables.

---

### Acceptance Criteria (Given-When-Then)

#### Scenario 1: Listado con pedidos existentes
- **GIVEN** existen 3 pedidos registrados
- **WHEN** un operador autenticado solicita `GET /api/orders`
- **THEN** recibe `200 OK` con un array de 3 elementos, cada uno con sus datos básicos y estado

#### Scenario 2: Listado vacío
- **GIVEN** no existe ningún pedido
- **WHEN** un operador autenticado solicita `GET /api/orders`
- **THEN** recibe `200 OK` con un array vacío `[]`

#### Scenario 3: Pedido inexistente
- **GIVEN** un `order_id` que no corresponde a ningún pedido
- **WHEN** un operador autenticado solicita `GET /api/orders/<order_id>`
- **THEN** recibe `404 Not Found`

---

### Example Mapping Table
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | 3 pedidos existentes | Operador autenticado | `GET /api/orders` | 200 OK; 3 elementos |
| EX-02 | Boundary | 0 pedidos existentes | Operador autenticado | `GET /api/orders` | 200 OK; `[]` |
| EX-03 | Error Case | `order_id=99999` inexistente | Operador autenticado | `GET /api/orders/99999` | 404 Not Found |
