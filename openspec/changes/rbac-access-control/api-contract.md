# API contract — rbac-access-control

> **Fuente única del contrato de API** entre backend y frontend para este change.
> Estado: **BORRADOR** (etapa 2). Se cierra en la etapa 6. Lo marcado **🔒 FIJO** ya no cambia y el frontend puede construir sobre eso.
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
| 403 | `FORBIDDEN` | Falta algún permiso requerido (AND). Mensaje: `"Acceso denegado: permisos insuficientes"`. 🔒 |
| 404 | `NOT_FOUND` | Usuario / grupo / rol / asignación inexistente. |
| 422 | `VALIDATION_ERROR` | Body inválido (tipos, vacíos, largo). |
| 422 | `UNKNOWN_PERMISSION` | `PUT /roles/{id}/permissions` con un code que no está en el catálogo. |
| 409 | `NAME_TAKEN` | Nombre de grupo o rol repetido. |
| 409 | `ALREADY_MEMBER` | El usuario ya pertenece al grupo. |
| 409 | `ALREADY_ASSIGNED` | El rol ya está asignado (al grupo o directo al usuario). |
| 409 | `ROLE_IN_USE` | `DELETE /roles/{id}` con el rol asignado a algún grupo o usuario (FK `RESTRICT`). |
| 409 | `SELF_LOCKOUT` | La operación dejaría al usuario actual (no superuser) sin `rbac:manage` efectivo. Rollback completo. |
| 409 | `SELF_ASSIGNMENT` | El usuario actual intenta asignarse a sí mismo un rol directo o agregarse a un grupo (ver §6, pregunta abierta Q1). |

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
`GET /api/rbac/users/{user_id}/access` (**no** `/effective-access`)
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
`POST /api/rbac/groups` `{ "name": "Operadores", "description": "…" }` → `201 {grupo}` · 409 `NAME_TAKEN` · 422
`GET /api/rbac/groups/{id}` → `200 {grupo}`
`PUT /api/rbac/groups/{id}` (mismo body) → `200 {grupo}` · 409 `NAME_TAKEN` · 422
`DELETE /api/rbac/groups/{id}` → `204` (membresías y roles del grupo se borran en cascada) · 409 `SELF_LOCKOUT`

`GET /api/rbac/groups/{id}/members` → `200 [ { "id": 7, "username": "ana", "is_active": true } ]`
`POST /api/rbac/groups/{id}/members` `{ "user_id": 7 }` → `201` · 409 `ALREADY_MEMBER` · 409 `SELF_ASSIGNMENT`
`DELETE /api/rbac/groups/{id}/members/{user_id}` → `204` · 409 `SELF_LOCKOUT`

`GET /api/rbac/groups/{id}/roles` → `200 [ { "id": 2, "name": "Operador", "description": "…" } ]`
`POST /api/rbac/groups/{id}/roles` `{ "role_id": 2 }` → `201` · 409 `ALREADY_ASSIGNED` · (Q1: ¿`SELF_ASSIGNMENT` si el actor es miembro?)
`DELETE /api/rbac/groups/{id}/roles/{role_id}` → `204` · 409 `SELF_LOCKOUT`

---

## 4. Roles (`rbac:read` / `rbac:manage`)

`GET /api/rbac/roles?q=` → `200 [ { "id": 2, "name": "Operador", "description": "…", "permissions_count": 14, "groups_count": 1, "direct_users_count": 0 } ]`
`POST /api/rbac/roles` `{ "name": "…", "description": "…" }` → `201` · 409 `NAME_TAKEN` · 422
`GET /api/rbac/roles/{id}` → `200 { "id": 2, "name": "Operador", "description": "…", "permissions": ["orders:read", "orders:update"] }`
`PUT /api/rbac/roles/{id}` `{ "name": "…", "description": "…" }` → `200` · 409 `NAME_TAKEN`
`DELETE /api/rbac/roles/{id}` → `204` · 409 `ROLE_IN_USE` (asignado a algún grupo o usuario: hay que desasignarlo antes; sus `role_permissions` se borran en cascada)
`PUT /api/rbac/roles/{id}/permissions` `{ "permissions": ["orders:read", "rbac:read"] }` (reemplazo completo) → `200 {rol}` · 422 `UNKNOWN_PERMISSION` · 409 `SELF_LOCKOUT`

---

## 5. Catálogo de permisos (`rbac:read`, solo lectura)

`GET /api/rbac/permissions`
```json
200
[ { "resource": "orders",
    "permissions": [
      { "code": "orders:delete", "action": "delete", "description": "Eliminar pedidos",
        "roles": [ { "id": 2, "name": "Encargado" } ] } ] },
  { "resource": "rbac", "permissions": [ … ] } ]
```
- Sin POST/PUT/DELETE: el catálogo sale del enum `Perm`.
- `resource_label` (etiqueta en español) del plan de frontend: **pendiente** (Q3).

---

## 6. Endpoints de impacto (borrador, a confirmar en etapa 6)

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

## Preguntas abiertas (se cierran antes / durante la etapa 6)

- **Q1 — Auto-escalada indirecta.** "Nadie se asigna roles a sí mismo" está cubierto para rol directo y para agregarse a un grupo. Pero quien tiene `rbac:manage` puede (a) agregar un rol a un grupo del que es miembro, o (b) agregar permisos a un rol que ya tiene. ¿Se bloquean también con `SELF_ASSIGNMENT`? Propuesta: **sí** para (a) y para (b) cuando el cambio **agrega** permisos que el actor no tenía. Nota: `rbac:manage` igual puede crear un usuario-cómplice… pero no hay ABM de usuarios, así que el bloqueo es efectivo.
- **Q2 — Status de `SELF_ASSIGNMENT`.** Propuesto 409 (regla de negocio, como `SELF_LOCKOUT`), no 403, para que el frontend no lo confunda con "te quitaron permisos" y no dispare `refresh()`.
- **Q3 — `resource_label`.** ¿El backend expone una etiqueta en español por recurso (dict en `constants.py`) o el frontend la mapea? Propuesta: backend (`RESOURCE_LABELS` junto a `PERM_DESCRIPTIONS`), para que haya un único lugar.
- **Q4 — Endpoints de impacto (§6).** Son 6 endpoints extra; ¿entran en la etapa 6 o quedan para una iteración posterior?
