# API contract — rbac-access-control

> **Fuente única del contrato de API** entre backend y frontend para este change.
> Estado: **BORRADOR** (actualizado en etapa 3 con Q1–Q4 respondidas). Se cierra en la etapa 6. Lo marcado **🔒 FIJO** ya no cambia y el frontend puede construir sobre eso.
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
`GET /api/rbac/users/{user_id}/access` (**no** `/effective-access`). Requiere `rbac:read`, y **también vale para el propio usuario** (`user_id` = actor): las lecturas no tienen restricción de "sí mismo". El frontend lo usa con su propio id para deshabilitar las acciones que darían `SELF_ASSIGNMENT` indirecto: grupos de los que es miembro (`roles[].sources[].group`) y roles que tiene (`roles[].role`). 🔒
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

## 6. Endpoints de impacto (entran en etapa 6 — Q4 aprobada; shape a cerrar en etapa 6)

Propuestos por el frontend para `ConfirmImpactDialog`; solo lectura (`rbac:read`), sin efectos:

- `GET /api/rbac/groups/{id}/roles/{role_id}/removal-impact`
- `GET /api/rbac/groups/{id}/members/{user_id}/removal-impact`
- `GET /api/rbac/users/{user_id}/roles/{role_id}/removal-impact`
- `GET /api/rbac/groups/{id}/removal-impact`, `GET /api/rbac/roles/{id}/removal-impact`
- `POST /api/rbac/roles/{id}/permissions/impact` `{ "permissions": [...] }`

```json
200
{ "affected_users_count": 4,
  "users_losing_permissions_count": 2,
  "affected_users": [ { "id": 7, "username": "ana", "lost_permissions": ["orders:update"] } ],
  "removes_own_rbac_manage": false }
```
El backend rechaza igual con 409 `SELF_LOCKOUT`; el impacto es solo UX.

---

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
