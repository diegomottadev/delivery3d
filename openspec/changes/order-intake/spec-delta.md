# Delta Specification: order-intake

> **Updated for the normalized schema** (see `design.md`'s superseded-schema notice). `POST /api/orders` now takes either `client_id` (existing client) or `client` (create new) plus an `items` array (one or more pieces, each referencing a `material_id`) — not a flat `customer_name`/`contact`/`piece_description` payload. All scenarios below match the actual implementation and passing test suite (`backend/tests/orders/test_intake.py`, 20 tests).

## ADDED Requirements

### Requirement: Manual Order Intake (client + multi-item)
The system MUST allow an authenticated operator to manually register a new order by submitting either an existing `client_id` or a new `client` object (`name`, `origin`, `phone`, `instagram_username`, `notes`), together with one or more `items` (each: `material_id`, `piece_description`, `reference_url`, `weight_g`, `print_time_minutes`, `quantity`). Every order MUST be created in status `nuevo`. `user_id` (the creator) MUST be assigned server-side from the authenticated operator's identity.

#### Scenarios (SBE Example Matrix)
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | `client={name:"Maria Fernandez", origin:"whatsapp", phone:"+54 9 11 5555-1234"}`, `items=[{material_id:1, piece_description:"Soporte para auricular", weight_g:120.00, print_time_minutes:210, quantity:1}]` | Operador autenticado | `POST /api/orders` | 201 Created; `status="nuevo"`; respuesta incluye `client.id` nuevo y `items` con 1 elemento |
| EX-02 | Happy Path | `client_id=<existente>`, `items=[...]` | Cliente ya existe | `POST /api/orders` | 201 Created; se reutiliza el cliente, no se crea uno nuevo |
| EX-03 | Happy Path (multi-item) | `items` con 2 elementos, cada uno con `material_id` distinto y `quantity` distinto | Operador autenticado, 2 materiales existentes | `POST /api/orders` | 201 Created; `items` en la respuesta tiene 2 elementos, cada uno con su `material_id` propio |
| EX-04 | Negative Case | Ni `client_id` ni `client` presentes | Operador autenticado | `POST /api/orders` | 422 Unprocessable Entity |
| EX-05 | Negative Case | Ambos `client_id` y `client` presentes | Operador autenticado | `POST /api/orders` | 422 Unprocessable Entity |
| EX-06 | Negative Case | `client.origin="carrier_pigeon"` (no es `whatsapp`/`instagram_dm`/`otro`) | Operador autenticado | `POST /api/orders` | 422 Unprocessable Entity |
| EX-07 | Negative Case | `items=[]` (vacío) | Operador autenticado | `POST /api/orders` | 422 Unprocessable Entity |
| EX-08 | Negative Case | `items[0].material_id` ausente | Operador autenticado | `POST /api/orders` | 422 Unprocessable Entity |
| EX-09 | Negative Case | `items[0].material_id=999999` (no existe) | Operador autenticado | `POST /api/orders` | 422 Unprocessable Entity |
| EX-10 | Negative Case | `items[0].weight_g=0` | Operador autenticado | `POST /api/orders` | 422 Unprocessable Entity |
| EX-11 | Negative Case | `items[0].print_time_minutes=0` | Operador autenticado | `POST /api/orders` | 422 Unprocessable Entity |
| EX-12 | Negative Case | `items[0].quantity=0` | Operador autenticado | `POST /api/orders` | 422 Unprocessable Entity |
| EX-13 | Boundary Case | `client.name` de exactamente 120 caracteres | Operador autenticado | `POST /api/orders` | 201 Created |
| EX-14 | Boundary +1 | `client.name` de 121 caracteres | Operador autenticado | `POST /api/orders` | 422 Unprocessable Entity |
| EX-15 | Technical Database Limits | `items[0].reference_url` de 501 caracteres | Operador autenticado | `POST /api/orders` | 422 Unprocessable Entity |
| EX-16 | Negative / Unauthorized | Sin JWT válido | Operador NO autenticado | `POST /api/orders` | 401 Unauthorized |
| EX-17 | Negative / Unauthorized | JWT malformado (no decodificable) | — | `POST /api/orders` | 401 Unauthorized |

#### Edge Cases & Validations
- Nombre de cliente vacío/solo espacios MUST ser rechazado.
- `client_id` inexistente MUST ser rechazado con 422 (no 404 — el error está en el payload de la orden, no en un recurso direccionado por URL).
- `quantity` por defecto es `1` si se omite.

---

### Requirement: Order Status History Recorded on Intake
Same invariant as before: exactly one `OrderStatusHistory` row (`from_status=NULL`, `to_status="nuevo"`) is created atomically with every new order.

#### Scenarios (SBE Example Matrix)
| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | Pedido recién creado | N/A | Alta exitosa | Exactamente 1 fila en `order_status_history`, `from_status=NULL`, `to_status='nuevo'`, `changed_by`=operador |

---

### Requirement: List Orders
Unchanged in contract shape (`GET /api/orders`), but each order in the response now includes `client`, `items[]`, `quote` (null until `quote-calculation` runs), and computed `production_cost`/`suggested_sale_price` (null until quoted).

#### Scenarios (SBE Example Matrix)
| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | 3 pedidos existentes | Operador autenticado | `GET /api/orders` | 200 OK; array de 3 elementos, cada uno con `client`/`items`/`quote` |
| EX-02 | Boundary | 0 pedidos | Operador autenticado | `GET /api/orders` | 200 OK; `[]` |
| EX-03 | Negative / Unauthorized | — | Sin JWT | `GET /api/orders` | 401 Unauthorized |

---

### Requirement: Retrieve Order by ID
Unchanged.

#### Scenarios (SBE Example Matrix)
| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | `order_id` existente | Operador autenticado | `GET /api/orders/<id>` | 200 OK |
| EX-02 | Negative Case | `order_id` inexistente | Operador autenticado | `GET /api/orders/<id>` | 404 Not Found |
| EX-03 | Negative / Unauthorized | — | Sin JWT | `GET /api/orders/<id>` | 401 Unauthorized |

---

## SBE Quality Checklist (Gojko Adzic Principles)
- [x] **Pure Domain Language**
- [x] **The Tester Test** — cada escenario mapea 1:1 a un test real en `test_intake.py`
- [x] **Concrete Example Table**
- [x] **Atomicity**

## Verified Against Real Tests
Los 17 escenarios de "Manual Order Intake" + variantes están cubiertos por 20 tests reales en `backend/tests/orders/test_intake.py`, corriendo contra MySQL 8.0 real (no mocks). 100% cobertura de líneas en `app/orders/schemas.py`, `app/orders/services.py` (porción de intake), `app/orders/routes.py` (porción de intake).

## Risks and Considerations (updated)
- **Resolved from the original Red Cards:** la dependencia dura con `auth` se resolvió con la tabla `users` stub + seed. El límite de `piece_description` sigue sin definirse explícitamente a nivel de negocio (columna `TEXT`, sin validación de longitud) — se mantiene como decisión abierta.
- **New risk (post-normalización):** `material_id` inexistente se valida en `services.create_order` (no en `schemas.py`) porque requiere una consulta a `materials` — un error ahí no es puramente de "forma" del payload sino de integridad referencial. Cubierto por `test_nonexistent_material_id_rejected`.
