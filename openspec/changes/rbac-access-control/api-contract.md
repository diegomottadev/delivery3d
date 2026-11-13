# API contract — rbac-access-control

> **Fuente única del contrato de API** entre backend y frontend para este change.
> Estado: **CERRADO** en la etapa 6 (implementado en `backend/app/rbac/routes.py`). Todo el documento es contrato fijo; §6 y §6.bis se cerraron en la etapa 6 sin cambiar shapes ya fijados.
> Parte de `frontend-plan.md` §10, con las decisiones aprobadas por el usuario (ver `design.md` → "Respuestas del usuario").

---

## 0. Convenciones

- JSON, `Authorization: Bearer <jwt>`. El JWT solo identifica (`sub`); **los permisos nunca se leen del token**.
- Fechas: ISO-8601 en UTC **sin sufijo de zona** (`"2026-11-10T14:03:00"`), igual que el resto de la API (`datetime.isoformat()` sobre `DATETIME` UTC). El frontend debe interpretarlas como UTC.
- Códigos de permiso: `"recurso:acción"`, minúsculas, snake_case, **recurso en inglés y en plural igual que el endpoint** (`orders:delete`, no `ordenes:delete`). Catálogo final en etapa 3 (`backend/app/rbac/constants.py`).
- Permisos de esta sección: lecturas `/api/rbac/*` → `rbac:read`; escrituras → `rbac:manage`. No existen permisos más finos (`rbac:users:read`, etc.).
- `is_superuser` pasa cualquier chequeo de permiso; **no** saltea `is_active` (inactivo → 401).

### Errores

Forma: `{"error": "<mensaje en español>", "code": "<MACHINE_CODE>"}`; 422 agrega `"errors": {"campo": "mensaje"}`.

| HTTP | `code` | Cuándo |
|---|---|---|
| 401 | *(sin `code`, comportamiento actual de `login_required`)* | Sin token, token inválido/expirado, usuario inexistente o inactivo. 🔒 |
| 403 | `FORBIDDEN` | Falta algún permiso requerido por `permission_required` (AND: hacen falta todos). Mensaje: `"Acceso denegado: permisos insuficientes"`. Aplica a **todos** los endpoints protegidos de la API (`/api/orders`, `/api/cashbox`, `/api/printers`, `/api/settings`, `/api/materials`, `/api/filaments`, `/api/rbac`), no solo a `/api/rbac`. 🔒 |
| 404 | `NOT_FOUND` | Usuario / grupo / rol / asignación inexistente. |
| 422 | `VALIDATION_ERROR` | Body inválido (tipos, vacíos, largo). |
| 422 | `UNKNOWN_PERMISSION` | `PUT /roles/{id}/permissions` con un code que no está en el catálogo. |
| 409 | `NAME_TAKEN` | Nombre de grupo o rol repetido. |
| 409 | `ALREADY_MEMBER` | El usuario ya pertenece al grupo. |
| 409 | `ALREADY_ASSIGNED` | El rol ya está asignado (al grupo o directo al usuario). |
| 409 | `ROLE_IN_USE` | `DELETE /roles/{id}` con el rol asignado a algún grupo o usuario (FK `RESTRICT`). |
| 409 | `SELF_LOCKOUT` | La operación dejaría al usuario actual (no superuser) sin `rbac:manage` efectivo. Rollback completo. |
| 409 | `SELF_ASSIGNMENT` | La operación le daría al usuario actual roles o permisos nuevos (regla completa abajo). Rollback completo. 🔒 |

### Regla `SELF_ASSIGNMENT` (Q1 + Q2 aprobadas) 🔒

Responde **409** `{"error": "No podés asignarte roles ni permisos a vos mismo", "code": "SELF_ASSIGNMENT"}` cuando el actor (`g.current_user`) intenta:

| Operación | Bloqueada si… |
|---|---|
| `POST /api/rbac/users/{user_id}/roles` | `user_id` = actor. |
| `POST /api/rbac/users/{user_id}/groups` | `user_id` = actor. |
| `POST /api/rbac/groups/{id}/members` | `user_id` del body = actor. |
| `POST /api/rbac/groups/{id}/roles` | el actor es **miembro** del grupo `{id}`. |
| `PUT /api/rbac/roles/{id}/permissions` | el actor **tiene** el rol `{id}` (directo o por cualquiera de sus grupos) **y** el nuevo set **agrega** al menos un permiso que el rol no tenía. Quitar permisos sí se permite (sujeto a `SELF_LOCKOUT`). |

- Los superusuarios quedan exentos: ya tienen todo, no ganan nada.
- Orden de chequeo en mutaciones: `FORBIDDEN` → `NOT_FOUND` → `VALIDATION_ERROR` → `SELF_ASSIGNMENT` / `SELF_LOCKOUT` → conflictos (`ALREADY_*`, `NAME_TAKEN`, `ROLE_IN_USE`).
- **No** existe `LAST_ADMIN`: el superusuario cubre el caso "nadie puede administrar".

---

## 1. Mis permisos — 🔒 FIJO

`GET /api/auth/me/permissions` — en `auth_bp`, solo `login_required` (no requiere ningún permiso).

```json
200
{
  "user_id": 1,
  "is_superuser": false,
  "permissions": ["orders:read", "orders:update", "rbac:read"]
}
```

- Lista **plana, efectiva** (unión grupo + directo), sin duplicados, ordenada alfabéticamente.
- Si `is_superuser = true`, `permissions` trae **el catálogo completo** (así un `can()` que no mire `is_superuser` igual funciona).
- 401 sin sesión.
- `GET /api/auth/me` y `POST /api/auth/login` **no cambian** (siguen devolviendo `role`, deprecado).

---

## 2. Usuarios (`rbac:read` / `rbac:manage`)

`GET /api/rbac/users?q=ana` — **sin paginación**. `q` opcional, busca en `username` case-insensitive.
```json
200
[ { "id": 7, "username": "ana", "is_active": true, "is_superuser": false,
    "groups_count": 2, "direct_roles_count": 1 } ]
```

`GET /api/rbac/users/{user_id}`
```json
200 { "id": 7, "username": "ana", "is_active": true, "is_superuser": false,
      "created_at": "2026-10-01T12:00:00", "updated_at": "2026-10-01T12:00:00" }
```
- `is_superuser` es **solo lectura**: no hay endpoint para cambiarlo (solo seed/CLI).

### Grupos del usuario
`GET /api/rbac/users/{user_id}/groups` → `200 [ { "id": 3, "name": "Operadores", "description": "…" } ]`
`POST /api/rbac/users/{user_id}/groups` `{ "group_id": 3 }` → `201 { "user_id": 7, "group_id": 3 }` · 404 · 409 `ALREADY_MEMBER` · 409 `SELF_ASSIGNMENT`
`DELETE /api/rbac/users/{user_id}/groups/{group_id}` → `204` · 404 · 409 `SELF_LOCKOUT`

### Roles directos (excepciones)
`GET /api/rbac/users/{user_id}/roles`
```json
200 [ { "id": 12,
        "role": { "id": 5, "name": "Auditor" },
        "reason": "Cubre auditoría de caja de noviembre",
        "assigned_by": { "id": 1, "username": "operador" },
        "assigned_at": "2026-11-10T14:03:00" } ]
```
- `assigned_by` es `null` si la asignación la hizo un seed/migración.

`POST /api/rbac/users/{user_id}/roles` `{ "role_id": 5, "reason": "texto" }` → `201` (mismo objeto)
- `reason` obligatorio, no vacío tras `trim`, máx. 255 → si no, 422 `VALIDATION_ERROR` con `errors.reason`.
- `assigned_by` = `g.current_user` (cualquier `assigned_by` del body se ignora).
- 404 · 409 `ALREADY_ASSIGNED` · 409 `SELF_ASSIGNMENT` (si `user_id` = usuario actual).

`DELETE /api/rbac/users/{user_id}/roles/{role_id}` → `204` · 404 · 409 `SELF_LOCKOUT`

### Acceso efectivo
`GET /api/rbac/users/{user_id}/access` (**no** `/effective-access`). Requiere `rbac:read`, y **también vale para el propio usuario** (`user_id` = actor): las lecturas no tienen restricción de "sí mismo". El frontend lo usa con su propio id para saber qué **roles** tiene (`roles[].role`) y deshabilitar `PUT /roles/{id}/permissions` que sumen permisos (`SELF_ASSIGNMENT`). 🔒
- ⚠️ `/access` **no** sirve para saber de qué grupos es miembro un usuario: `roles[].sources[].group` solo muestra grupos que le dan algún rol (un grupo sin roles no aparece). Para la membresía: `GroupDetail.members` (o `GET /groups/{id}/members`) para saber si el actor es miembro de un grupo (y deshabilitar `POST /groups/{id}/roles`), o `GET /users/{user_id}/groups` para la lista completa de grupos de un usuario.
```json
200
{
  "user_id": 7,
  "username": "ana",
  "is_active": true,
  "is_superuser": false,
  "roles": [
    { "role": { "id": 2, "name": "Operador" },
      "sources": [ { "type": "group", "group": { "id": 3, "name": "Operadores" } } ] },
    { "role": { "id": 5, "name": "Auditor" },
      "sources": [ { "type": "direct", "reason": "Cubre auditoría de caja de noviembre",
                     "assigned_by": { "id": 1, "username": "operador" },
                     "assigned_at": "2026-11-10T14:03:00" } ] }
  ],
  "permissions": [
    { "code": "orders:read", "resource": "orders", "action": "read",
      "description": "Ver pedidos",
      "sources": [
        { "type": "group", "group": { "id": 3, "name": "Operadores" }, "role": { "id": 2, "name": "Operador" } },
        { "type": "direct", "role": { "id": 5, "name": "Auditor" } } ] }
  ]
}
```
- Un rol puede tener varias `sources` (por dos grupos y/o directo).
- Con `is_superuser = true`: `roles` igual (lo que tenga asignado), `permissions` = catálogo completo con `sources: [{ "type": "superuser" }]`.

---

## 3. Grupos (`rbac:read` / `rbac:manage`)

`GET /api/rbac/groups?q=` → `200 [ { "id": 3, "name": "Operadores", "description": "…", "members_count": 4, "roles_count": 1 } ]`
**`GroupDetail`** (respuesta de todo endpoint que crea o modifica un grupo o su contenido):
```json
{ "id": 3, "name": "Operadores", "description": "Operadores del taller",
  "created_at": "2026-11-12T12:00:00", "updated_at": "2026-11-12T12:00:00",
  "members": [ { "id": 7, "username": "ana", "is_active": true } ],
  "roles":   [ { "id": 2, "name": "Operador", "description": "…" } ] }
```
(`members` ordenado por `username`; `roles` por `name`.)

`POST /api/rbac/groups` `{ "name": "Operadores", "description": "…" }` → `201 GroupDetail` · 409 `NAME_TAKEN` · 422
`GET /api/rbac/groups/{id}` → `200 GroupDetail`
`PUT /api/rbac/groups/{id}` (mismo body) → `200 GroupDetail` · 409 `NAME_TAKEN` · 422
`DELETE /api/rbac/groups/{id}` → `204` (membresías y roles del grupo se borran en cascada) · 409 `SELF_LOCKOUT`

`GET /api/rbac/groups/{id}/members` → `200 [ { "id": 7, "username": "ana", "is_active": true } ]`
`POST /api/rbac/groups/{id}/members` `{ "user_id": 7 }` → `201 GroupDetail` (actualizado) · 409 `ALREADY_MEMBER` · 409 `SELF_ASSIGNMENT`
`DELETE /api/rbac/groups/{id}/members/{user_id}` → `204` · 409 `SELF_LOCKOUT`

`GET /api/rbac/groups/{id}/roles` → `200 [ { "id": 2, "name": "Operador", "description": "…" } ]`
`POST /api/rbac/groups/{id}/roles` `{ "role_id": 2 }` → `201 GroupDetail` (actualizado) · 409 `ALREADY_ASSIGNED` · 409 `SELF_ASSIGNMENT` (si el actor es miembro del grupo)
`DELETE /api/rbac/groups/{id}/roles/{role_id}` → `204` · 409 `SELF_LOCKOUT`

---

## 4. Roles (`rbac:read` / `rbac:manage`)

`GET /api/rbac/roles?q=` → `200 [ { "id": 2, "name": "Operador", "description": "…", "permissions_count": 14, "groups_count": 1, "direct_users_count": 0 } ]`
**`RoleDetail`** (respuesta de todo endpoint que crea o modifica un rol):
```json
{ "id": 2, "name": "Operador", "description": "…",
  "created_at": "2026-11-12T12:00:00", "updated_at": "2026-11-12T12:00:00",
  "permissions": ["orders:read", "orders:update"] }
```
(`permissions` ordenado alfabéticamente.)

`POST /api/rbac/roles` `{ "name": "…", "description": "…" }` → `201 RoleDetail` · 409 `NAME_TAKEN` · 422
`GET /api/rbac/roles/{id}` → `200 RoleDetail`
`PUT /api/rbac/roles/{id}` `{ "name": "…", "description": "…" }` → `200 RoleDetail` · 409 `NAME_TAKEN` · 422
`DELETE /api/rbac/roles/{id}` → `204` · 409 `ROLE_IN_USE` (asignado a algún grupo o usuario: hay que desasignarlo antes; sus `role_permissions` se borran en cascada)
`PUT /api/rbac/roles/{id}/permissions` `{ "permissions": ["orders:read", "rbac:read"] }` (reemplazo completo) → `200 RoleDetail` · 422 `UNKNOWN_PERMISSION` · 409 `SELF_LOCKOUT` · 409 `SELF_ASSIGNMENT` (si el actor tiene el rol y el set agrega permisos)

---

## 5. Catálogo de permisos (`rbac:read`, solo lectura)

`GET /api/rbac/permissions`
```json
200
[ { "resource": "orders", "resource_label": "Pedidos",
    "permissions": [
      { "code": "orders:delete", "action": "delete", "description": "Eliminar pedidos",
        "roles": [ { "id": 2, "name": "Encargado" } ] } ] },
  { "resource": "rbac", "resource_label": "Seguridad", "permissions": [ … ] } ]
```
- Sin POST/PUT/DELETE: el catálogo sale del enum `Perm`.
- `resource_label` sale de `RESOURCE_LABELS` en `backend/app/rbac/constants.py` (Q3 aprobada). Los grupos vienen en el orden de `RESOURCE_LABELS`; dentro de cada grupo, los permisos van en el orden del enum `Perm`.
- Catálogo propuesto: ver `design.md` → "Etapa 3 — propuesta de catálogo".

---

## 6. Endpoints de impacto — 🔒 FIJO (etapa 6)

Solo lectura (`rbac:read`), **sin efectos**. Sirven para `ConfirmImpactDialog`: antes de quitar algo, muestran a quiénes afecta y qué permisos pierden. Son solo UX: la mutación correspondiente vuelve a chequear y responde 409 `SELF_LOCKOUT` aunque el frontend no haya consultado el impacto.

| Endpoint | Simula | Usuarios afectados |
|---|---|---|
| `GET /api/rbac/groups/{id}/roles/{role_id}/removal-impact` | `DELETE /groups/{id}/roles/{role_id}` | miembros del grupo |
| `GET /api/rbac/groups/{id}/members/{user_id}/removal-impact` | `DELETE /groups/{id}/members/{user_id}` (= `DELETE /users/{user_id}/groups/{id}`) | ese usuario |
| `GET /api/rbac/users/{user_id}/roles/{role_id}/removal-impact` | `DELETE /users/{user_id}/roles/{role_id}` | ese usuario |
| `GET /api/rbac/groups/{id}/removal-impact` | `DELETE /groups/{id}` | miembros del grupo |
| `GET /api/rbac/roles/{id}/removal-impact` | quitar el rol de **todos** lados | quienes tienen el rol (por cualquier grupo o directo) |
| `POST /api/rbac/roles/{id}/permissions/impact` `{ "permissions": [...] }` | `PUT /roles/{id}/permissions` con ese set | quienes tienen el rol |

```json
200
{ "affected_users_count": 3,
  "users_losing_permissions_count": 2,
  "affected_users": [
    { "id": 7, "username": "ana",
      "lost_permissions": ["orders:read", "printers:read"],
      "lost_permissions_detail": [
        { "code": "orders:read",   "description": "Ver pedidos, su detalle e historial de estados" },
        { "code": "printers:read", "description": "Ver las impresoras del taller" } ] },
    { "id": 8, "username": "beto",
      "lost_permissions": ["printers:read"],
      "lost_permissions_detail": [ { "code": "printers:read", "description": "Ver las impresoras del taller" } ] },
    { "id": 9, "username": "carla", "lost_permissions": [], "lost_permissions_detail": [] } ],
  "removes_own_rbac_manage": false }
```
- `affected_users`: ordenado por `username`; incluye a todos los afectados aunque no pierdan nada.
- `lost_permissions`: permisos efectivos que el usuario **deja de tener**, ordenados alfabéticamente. Contempla las otras vías: si el permiso le llega también por otro grupo o por un rol directo, no aparece. Un superusuario siempre tiene `[]`.
- `lost_permissions_detail` (**aditivo**, agregado en el cierre a pedido del frontend): los mismos permisos de `lost_permissions`, en el mismo orden, como `{code, description}` (descripción de la tabla `permissions`). `lost_permissions` no cambia.
- `users_losing_permissions_count`: afectados con `lost_permissions` no vacío.
- `removes_own_rbac_manage`: `true` si el actor (no superusuario) está entre los afectados y pierde `rbac:manage`. Es exactamente la condición con la que la mutación responde 409 `SELF_LOCKOUT` (mismo cálculo en el backend).
- **`roles/{id}/removal-impact`** describe qué pasaría si el rol se quitara de todos lados; `DELETE /roles/{id}` igual exige que no esté asignado (409 `ROLE_IN_USE`), así que en la práctica el frontend lo usa para explicar por qué no se puede borrar y a quiénes afectaría desasignarlo.
- `POST …/permissions/impact`: mismo body y validación que `PUT /roles/{id}/permissions` (422 `VALIDATION_ERROR` si `permissions` no es lista de strings, 422 `UNKNOWN_PERMISSION` con `errors.permissions`). No informa permisos ganados ni `SELF_ASSIGNMENT` (para eso, `GET /users/{id}/access` del propio usuario).
- Errores: 401 · 403 `FORBIDDEN` · 404 `NOT_FOUND` si no existe el grupo/rol/usuario **o la asignación** (ej. el rol no está en el grupo; el usuario no es miembro) — mismo 404 que daría el `DELETE`.

---

## 6.bis Detalles cerrados en la etapa 6 (no cambian shapes ya fijados)

- **Orden de chequeo**, completo: `401` → `403 FORBIDDEN` → `404` de los ids del **path** → `422 VALIDATION_ERROR` / `UNKNOWN_PERMISSION` del body → `404` de los ids del **body** (`user_id`, `group_id`, `role_id` válidos pero inexistentes) → `409 SELF_ASSIGNMENT` / `SELF_LOCKOUT` → `409` conflictos (`ALREADY_*`, `NAME_TAKEN`, `ROLE_IN_USE`). Ej.: el actor agregándose a un grupo del que ya es miembro → `SELF_ASSIGNMENT`, no `ALREADY_MEMBER`.
- **Rollback de `SELF_*`:** se evalúan antes de escribir; un 409 no deja ningún cambio.
- **`SELF_ASSIGNMENT` en `POST /groups/{id}/members` y `POST /users/{id}/groups`**: aplica aunque el grupo no tenga roles hoy (luego podría tenerlos).
- **`DELETE /roles/{id}`** nunca responde `SELF_LOCKOUT`: si el rol está asignado es `ROLE_IN_USE`, y si no lo está, borrarlo no le quita nada a nadie.
- **422:** `{"error": "Datos inválidos", "code": "VALIDATION_ERROR", "errors": {"campo": "msg"}}`. Un body que no es objeto JSON → 422 `VALIDATION_ERROR` con `errors: {}`. Ids del body: entero positivo (`"7"`, `true`, `null` → 422).
- **Nombres** (`groups`, `roles`): obligatorios, `trim`, máx. 100; `NAME_TAKEN` sin distinguir mayúsculas (collation de la base). `description`: string o `null`, `trim`, máx. 255, vacío → `null`. **`PUT` es reemplazo completo**: sin `description` queda `null`.
- **`?q=`** (users/groups/roles): substring sin distinguir mayúsculas; `%` y `_` se buscan literales; máx. 100 caracteres (422 con `errors.q`). Listados ordenados por `username` / `name`.
- **`PUT /roles/{id}/permissions`**: codes duplicados se ignoran; `[]` vale (rol sin permisos). Un code es válido si está en `Perm` **y** en la tabla `permissions` (catálogo sincronizado por el seed). `UNKNOWN_PERMISSION` trae `errors.permissions` con los codes rechazados.
- **`GET /users/{id}/access`**: `roles` ordenado por nombre del rol; en cada rol, `sources` primero los grupos (por nombre) y después el directo. `permissions` ordenado por `code`; sus `sources` siguen el mismo orden (grupo por nombre, luego rol; después directos por nombre de rol). Con superusuario, `permissions` sale del enum `Perm` (descripción de `PERM_DESCRIPTIONS`).
- **`GET /users/{id}/roles`**: ordenado por nombre del rol. `POST` devuelve el mismo objeto; `reason` se guarda con `trim`.
- **Auditoría**: `created_by`/`updated_by`/`assigned_by` = usuario autenticado; esos campos (y `is_superuser`) del body se ignoran. Cada mutación deja una línea en el logger `delivery3d.audit` con `actor_id`.
- `is_superuser`: no hay `PUT`/`PATCH /users/{id}` (405).

## 7. Sincronía `perms.js` ↔ `Perm` (etapa 3/4)

- Archivo frontend: `frontend/src/features/security/permissions/perms.js`.
- Formato que el test backend va a parsear: una entrada por línea dentro de `export const PERM = Object.freeze({ ... })`, `NOMBRE_MIEMBRO: 'recurso:acción',`. Los nombres de miembro son iguales a los del enum Python (`RBAC_READ` ↔ `Perm.RBAC_READ`).
- El test falla si hay un miembro de más o de menos, o si un mismo nombre tiene un code distinto.
- `orders:read` **va a existir** (lo requieren `GET /api/orders`, `GET /api/orders/<id>` y `/history`). El recurso es `orders`, no `ordenes`. El catálogo completo se fija en la etapa 3.

---

## Preguntas respondidas

- **Q1:** sí, también se bloquea la autoescalada indirecta → regla `SELF_ASSIGNMENT` (§0).
- **Q2:** `SELF_ASSIGNMENT` responde 409, igual que `SELF_LOCKOUT`.
- **Q3:** el backend da las etiquetas: `RESOURCE_LABELS` en `constants.py`, y `resource_label` en el catálogo.
- **Q4:** los endpoints de impacto entran en la etapa 6.
