# Delta Specification: rbac-access-control

> **Especifica solo lo que cambia.** Se integra a `openspec/specs/auth/spec.md` y `openspec/specs/orders/spec.md` en el `sync`.
> Contrato de API detallado: `api-contract.md`. Modelo y decisiones: `design.md`.

## ADDED Requirements

### Requirement: REQ-AUTH-04 Autorización por permisos (RBAC mixto)
El sistema DEBE autorizar cada operación del taller según los permisos efectivos del usuario, resueltos en cada solicitud contra la base de datos.
- Los permisos efectivos son la unión de los permisos de los roles que el usuario recibe por sus grupos y por asignación directa. No hay denegaciones, jerarquía de roles ni comodines.
- Un superusuario tiene todos los permisos. Un usuario inactivo no accede, aunque sea superusuario.
- Cuando una operación exige varios permisos, hacen falta todos.
- Un permiso quitado deja de valer en la solicitud siguiente, sin cerrar la sesión.

#### Scenarios (SBE Example Matrix)
| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | Usuaria "ana" en el grupo "Operadores" (rol "Operador") | Activa | Consulta el listado de pedidos | 200 con los pedidos |
| EX-02 | Error Case | Usuario sin grupos ni roles | Activo | Consulta el listado de pedidos | 403 `{"error": "Acceso denegado: permisos insuficientes", "code": "FORBIDDEN"}` |
| EX-03 | Happy Path | `orders:read` por grupo + `orders:delete` por rol directo | Activa | Operación que exige ambos | Permitida |
| EX-04 | Boundary | Superusuario sin roles | Activo | Cambia la configuración del taller | Permitido |
| EX-05 | Error Case | Superusuario | **Inactivo** | Cualquier operación | 401 |
| EX-06 | Boundary | "ana" pierde su grupo entre dos solicitudes | Activa | Repite la consulta | La primera da 200 y la segunda 403 |
| EX-07 | Error Case | Sin sesión | — | Cualquier operación del taller | 401 |

### Requirement: REQ-AUTH-05 Consulta de permisos propios
El sistema DEBE informar al usuario autenticado sus permisos efectivos (`GET /api/auth/me/permissions`). Solo se exige sesión.

| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | "ana" con `orders:read` por grupo y por rol directo, y `printers:read` por grupo | Activa | Consulta sus permisos | `{"user_id": <id>, "is_superuser": false, "permissions": ["orders:read", "printers:read"]}`, ordenada y sin duplicados |
| EX-02 | Boundary | Usuario sin roles | Activo | Consulta sus permisos | 200 con `permissions: []` |
| EX-03 | Happy Path | Superusuario | Activo | Consulta sus permisos | `is_superuser: true` y los 22 permisos del catálogo |
| EX-04 | Error Case | Sin sesión | — | Consulta sus permisos | 401 |

### Requirement: REQ-ORD-QUOTE-LOCK El presupuesto usa los costos y el margen del taller si quien presupuesta no administra la configuración
Si quien presupuesta no tiene el permiso `settings:update`, el sistema DEBE usar siempre los valores del taller e ignorar los que vengan en la solicitud:
- de la configuración: costo del kWh, margen, merma/purga y tarifa por hora de mano de obra;
- de la impresora: potencia y costo por hora.

Quien presupuesta sí elige la impresora (si no elige, se usa la impresora por defecto del taller) y los minutos de mano de obra (si no los indica, se usa el valor por defecto del taller). La mano de obra se calcula siempre por hora. El precio informado al confirmar lo sigue fijando quien presupuesta. Con `settings:update`, se respetan todos los valores enviados.

| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | Operadora envía kWh 9999 y margen 900 % | Taller: kWh 200, multiplicador 1,50; impresora por defecto "Bambu A1" (120 W, 300 $/h) | Presupuesta | Se guardan kWh 200, margen 50 %, 120 W, 300 $/h y la impresora "Bambu A1" |
| EX-02 | Happy Path | Operadora elige "Prusa MK4" (200 W, 500 $/h) | Idem | Presupuesta | Se usan 200 W y 500 $/h |
| EX-03 | Happy Path | Operadora indica 20 minutos y una tarifa de 99999 $/h | Taller: 600 $/h, merma 8 % | Presupuesta | Tarifa 600 $/h, merma 8 %, mano de obra 200,00 |
| EX-04 | Boundary | Operadora no indica minutos | Taller: 30 min por defecto | Presupuesta | 30 minutos, mano de obra 300,00 |
| EX-05 | Error Case | Operadora no elige impresora | Taller sin impresora por defecto | Presupuesta | 422 con error en `printer_id` |
| EX-06 | Happy Path | Operadora confirma con precio informado 15000 | Pedido presupuestado | Confirma | 200, estado `presupuestado`, precio informado 15000 |
| EX-07 | Happy Path | Encargada con `settings:update` envía kWh 150 y margen 40 % | Idem EX-01 | Presupuesta | Se respetan kWh 150 y margen 40 % |

---

## MODIFIED Requirements

### Requirement: Order Deletion (Eliminación de Pedidos con Confirmación)
*(Origen: `openspec/archive/2026-09-18-order-deletion/spec-delta.md`)*

**Previous Behavior:**
Antes, el sistema permitía a **cualquier operador autenticado** eliminar permanentemente un pedido en cualquier etapa del ciclo de vida mediante `DELETE /api/orders/<id>`. La interfaz mostraba el botón de eliminación en todas las columnas del tablero y en la tabla de órdenes.

**New Behavior:**
El sistema DEBE permitir la eliminación permanente de un pedido **solo a usuarios con el permiso `orders:delete`** (o a superusuarios), en cualquier etapa del ciclo de vida.
- Sin ese permiso, la solicitud se rechaza con 403 `{"error": "Acceso denegado: permisos insuficientes", "code": "FORBIDDEN"}` y el pedido no se modifica.
- El rol "Operador" **no** incluye `orders:delete`.
- **Sin cambios:** borrado en cascada de piezas, cotización e historial, y conservación de los movimientos de caja con `order_id = NULL`.
- En la interfaz, el botón de eliminación y su confirmación aparecen solo si el usuario tiene `orders:delete`.

| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | Usuario con `orders:delete` | Pedido #12 en estado `entregado` con seña cobrada | Elimina el pedido | 200; el pedido, sus piezas, cotización e historial desaparecen; la seña queda en caja con `order_id = NULL` |
| EX-02 | Error Case | Operadora (rol "Operador") | Pedido #12 en estado `nuevo` | Intenta eliminar | 403 FORBIDDEN; el pedido sigue existiendo |
| EX-03 | Error Case | Usuario con `orders:delete` | Pedido inexistente | Elimina | 404 |
| EX-04 | Error Case | Sin sesión | — | Elimina | 401 |

### Requirement: REQ-AUTH-02 / roles
**Previous Behavior:**
Antes, el control de roles era `@roles_required(*roles)`, basado en `users.role` (`admin` / `operator`), y ninguna ruta lo usaba.

**New Behavior:**
La autorización DEBE hacerse por permisos (REQ-AUTH-04). `users.role` queda deprecada: no autoriza nada y solo se conserva en las respuestas de login y `/me` hasta un cambio futuro. El JWT solo transporta la identidad (`sub`).

---

## REMOVED Requirements
- Ninguno en este cambio. `roles_required` se marca como deprecado pero sigue en el código; se elimina junto con `users.role` en un cambio posterior.

---

## SBE Quality Checklist (Gojko Adzic Principles)
- [x] **Pure Domain Language**
- [x] **The Tester Test:** cada fila se verifica con una solicitud HTTP y su respuesta.
- [x] **Concrete Example Table:** casos felices, límites y errores.
