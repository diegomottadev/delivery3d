# Frontend plan — rbac-access-control

> Autor: agente FRONTEND. Estado: **borrador para aprobación** (sin código todavía).
> Complementa `proposal.md` / `design.md` (backend) de este mismo change; no los reemplaza.

## 0. Decisiones confirmadas por el usuario (prevalecen sobre el resto del documento)

- 403 → ruta nueva **`/acceso-denegado` dentro del layout** (conserva el menú). `/access` no se toca.
- Sección Seguridad: solo `rbac:read` (lecturas) y `rbac:manage` (escrituras). Formato siempre `recurso:acción` con un solo `:`.
- "Usuarios afectados": se muestran los dos números (miembros y los que pierden permisos).
- Listado de usuarios **sin paginar**: se trae todo y se filtra en el front.
- Rol en uso no se borra: backend 409 `ROLE_IN_USE`. Sin `LAST_ADMIN` (lo cubre el superusuario).
- Habrá test backend que compara `perms.js` con el enum `Perm`.
- Acceso efectivo: `GET /api/rbac/users/<id>/access` (no `/effective-access`). Errores con `code` (`SELF_LOCKOUT`, `ROLE_IN_USE`, `SELF_ASSIGNMENT`).
- **Fuente única del contrato: `api-contract.md`** (backend). La §10 de este documento queda como propuesta histórica.
- Base de permisos implementada (ronda 2): `features/security/{securityApi.js, AccessDeniedView.jsx, SecurityPlaceholderView.jsx, permissions/*}`, `navigation/{menuConfig.js, buildMenu.js}`.

---

## 1. Relevamiento del código actual

| Tema | Hallazgo (código real) |
|---|---|
| Librerías | React 18.2, react-router-dom **6.3.0** (`HashRouter` en `src/index.js`), PrimeReact **8.7.3** (instalado; `^8.6.1` en package.json), PrimeFlex 3, PrimeIcons 6, **axios ^0.19.0**, react-transition-group (transitiva, la usa `AppMenu.js`), Chart.js, FullCalendar. Tests: jest de `react-scripts 5`, `@testing-library/react 13.4` (trae `renderHook`), `jest-dom`, `user-event 13`. |
| Estado global | **Solo React Context**: `features/auth/AuthContext.js` (`token`, `user`, `isAuthenticated`, `loading`, `login`, `logout`). No hay Redux, Zustand ni TanStack Query. `token` y `user` en `localStorage`. |
| Router | `AppWrapper.js`: rutas públicas `/login`, `/error`, `/notfound`, `/access`, `/wizard` y `/*` → `<ProtectedRoute><App/></ProtectedRoute>`. `App.js` tiene un `<Routes>` interno con `/`, `/orders`, `/cashbox`, `/cashbox/settings`, `/settings` y `*` → dashboard. |
| Menú | `App.js` define `menu` (array literal con `label`, `icon`, `to`) y `breadcrumb` (otro array paralelo). `AppMenu.js` (Babylon) ya soporta `item.visible` (bool o función) — no hay ifs en JSX, pero tampoco hay noción de permiso. |
| HTTP | Cada `*Api.js` (`ordersApi.js`, `cashboxApi.js`) duplica `getHeaders()` leyendo el token de `localStorage` por request (no hay token embebido; test `authHeaders.test.js`). Interceptor global en `AuthContext` solo maneja **401** (logout + `#/login`). **403 no tiene manejo global.** |
| Errores / toasts | Por vista: `const toast = useRef()` + `<Toast ref={toast}/>`, `err.response?.data?.error` y para 422 `err.response.data.errors` (dict campo→mensaje). |
| Confirmaciones | `<Dialog>` modal propio con botones Cancelar / Confirmar (`OrderList.jsx`, `OrderBoard.jsx`), no `confirmDialog()`. |
| Página 403 | **Sí existe** `pages/Access.js` (Babylon, en inglés, layout full-page `exception-body access-denied`), ya ruteada como `/access` **pública** en `AppWrapper.js`. |
| Backend auth | Blueprint `auth_bp` con prefijo **`/api/auth`** (`/login`, `/me`). `roles_required(*roles)` responde `403 {"error": "Acceso denegado: permisos insuficientes"}`. `User.to_dict()` = `{id, username, role, is_active, created_at}`. |
| Patrón de tests | `jest.mock('./xxxApi')` + `render` + `waitFor` (ej. `CashboxSettingsView.test.js`); `AuthContext.test.js` con componente consumidor de prueba. |

## 2. Librerías

**No se agrega ninguna dependencia.** Todo se resuelve con lo instalado:

- Estado: React Context (mismo patrón que `AuthContext`).
- UI: PrimeReact `DataTable` (filtro global), `TabView`, `Checkbox`, `Dialog`, `MultiSelect`/`Dropdown`, `InputTextarea`, `Tag`, `Message`, `Toast`, `Skeleton`.
- Tests: `@testing-library/react` 13.4 (`render`, `renderHook`), `MemoryRouter` de react-router 6.3.

Propuestas **opcionales** (no las agrego, solo las dejo justificadas):

| Lib | Para qué | Recomendación |
|---|---|---|
| `@tanstack/react-query` v4 | Cache + `invalidateQueries` para "invalidar datos afectados". | **No ahora.** El proyecto no la usa; meterla solo para Seguridad crea dos estilos de data-fetching. Las vistas de Seguridad son por ruta y re-fetchean al montar; alcanza con `reload()` local + `refreshPermissions()`. Reevaluar si se migra todo el front. |
| Upgrade `axios` 0.19 → 1.x | 0.19 tiene CVEs conocidos (A03 OWASP). | Fuera de alcance de este change; lo dejo anotado como riesgo para un change aparte (`npm audit`). |

## 3. Dónde vive el estado de permisos y por qué

**Nuevo `PermissionsProvider` (React Context) en `features/security/permissions/PermissionsContext.js`, montado dentro de `AuthProvider` en `AppWrapper.js`.**

```
<AuthProvider>            // token, user (ya existe, no cambia su API)
  <PermissionsProvider>   // { isSuperuser, permissions:Set, status, refresh() }
    <Routes>…</Routes>
```

Por qué:
- Es el mecanismo de estado global que ya usa el proyecto (Context). No hay store a reutilizar.
- Provider **separado** de `AuthContext`: responsabilidad única, `AuthContext` y sus tests quedan intactos; `PermissionsProvider` depende de `useAuth().token`.
- Carga: `useEffect` sobre `token` → si hay token, `GET /api/auth/me/permissions`; si no, limpia. Cubre login, recarga de página (F5) y logout con un único camino.
- **No se persiste en `localStorage`** (regla OWASP del skill: "no guardar más que el token"). Se reconsulta en cada arranque; es barato y evita permisos viejos/manipulables. Igualmente, manipularlos en memoria solo cambia la UX: el backend valida todo.
- `status: 'idle' | 'loading' | 'ready' | 'error'`. Mientras `loading`, los guards muestran spinner (no redirigen a 403 por error de carrera). Si falla (≠401) → **fail-closed**: `permissions` vacío, `can()` = false, banner "No se pudieron cargar tus permisos. Reintentar".
- `refresh()` se expone para llamarlo tras cualquier mutación de grupos/roles/asignaciones y tras recibir un 403 inesperado.

### Espejo del enum `Perm`

`features/security/permissions/perms.js` (el proyecto es JS, no TS):

```js
/** @typedef {'rbac:read'|'rbac:manage'|'ordenes:delete'|…} PermCode */
export const PERM = Object.freeze({
  RBAC_READ: 'rbac:read',
  RBAC_MANAGE: 'rbac:manage',
  ORDENES_DELETE: 'ordenes:delete',
  // … uno por miembro del enum Perm del backend, mismo nombre de miembro
});
export const ALL_PERMS = Object.freeze(Object.values(PERM));
```

- `can()`, `<Can>`, `<RequirePermission>` y la config del menú **solo** reciben `PERM.X`. `can()` en desarrollo hace `console.warn` si recibe un string que no está en `ALL_PERMS` (detecta strings sueltos/typos).
- Sincronía front↔back: en dev, `PermissionsProvider` advierte si `/me/permissions` trae codes desconocidos. Opcional (a acordar con backend): un test pytest que parsee `perms.js` y lo compare con `Perm`, para que el CI falle si divergen.

## 4. API de permisos (base, se hace primero)

```js
const { can, canAny, isSuperuser, status, refresh } = usePermissions();
can(PERM.RBAC_MANAGE)                       // superuser → true siempre
canAny(PERM.RBAC_READ, PERM.RBAC_MANAGE)    // varargs; sin args → false

<Can perm={PERM.RBAC_MANAGE} fallback={null}>…</Can>
<Can anyOf={[PERM.RBAC_READ, PERM.RBAC_MANAGE]}>…</Can>

<RequirePermission perm={PERM.RBAC_READ}>  // o anyOf=[…]
  <UsersListView/>
</RequirePermission>
// loading → spinner; sin permiso → <Navigate to="/access" replace state={{ from, required }}/>
```

## 5. Mapa de rutas

Todas dentro de `App.js` (layout con menú), salvo `/access`.

| Ruta | Componente | Guard (`RequirePermission`) |
|---|---|---|
| `/seguridad/usuarios` | `UsersListView` | `PERM.RBAC_READ` |
| `/seguridad/usuarios/:userId` | `UserDetailView` (tabs Grupos / Roles directos / Acceso efectivo) | `PERM.RBAC_READ` (acciones con `<Can RBAC_MANAGE>`) |
| `/seguridad/grupos` | `GroupsListView` (CRUD) | `PERM.RBAC_READ` |
| `/seguridad/grupos/:groupId` | `GroupDetailView` (miembros + roles) | `PERM.RBAC_READ` |
| `/seguridad/roles` | `RolesListView` (CRUD) | `PERM.RBAC_READ` |
| `/seguridad/roles/:roleId` | `RoleDetailView` (checkboxes por resource) | `PERM.RBAC_READ` |
| `/seguridad/permisos` | `PermissionsCatalogView` (solo lectura) | `PERM.RBAC_READ` |
| `/access` (ya existe, pública) | `pages/Access.js` traducida a español, con link "Volver al tablero" vía `<Link>` | — |

- Destino del 403: **reutilizar `/access`** (decisión a confirmar, ver preguntas). Alternativa: `/acceso-denegado` dentro del layout para no perder el menú.
- El `*` de `App.js` sigue yendo al dashboard; no lo toco.
- Rutas, menú y breadcrumb salen de **la misma config** (ver §7) para que no diverjan.
- Si en el futuro hay permisos más finos por pantalla (ej. `rbac:users:read`), solo cambia la config.

## 6. Árbol de componentes

```
index.js
└─ HashRouter
   └─ AppWrapper
      └─ AuthProvider                         (existente)
         └─ PermissionsProvider               (nuevo)
            └─ Routes
               ├─ /login, /error, /notfound, /access, /wizard
               └─ /* ProtectedRoute
                  └─ App
                     ├─ AppMenu  model={buildMenu(MENU_CONFIG, can)}
                     ├─ AppBreadcrumb meta={…de ROUTE_META}
                     └─ Routes
                        ├─ (rutas actuales)
                        └─ /seguridad/*  → RequirePermission → vista
                           ├─ UsersListView
                           │   └─ DataTable (búsqueda global, server-side q)
                           ├─ UserDetailView
                           │   ├─ UserHeader (username, activo, superuser Tag)
                           │   └─ TabView
                           │      ├─ UserGroupsTab        (asignar MultiSelect / quitar → ConfirmImpactDialog)
                           │      ├─ UserDirectRolesTab   (AssignRoleDialog con motivo obligatorio; columnas asignado_por, fecha, motivo)
                           │      └─ UserEffectiveAccessTab (DataTable agrupada por resource; columna "Origen": "vía grupo X → rol Y" / "directo → rol Y")
                           ├─ GroupsListView  + GroupFormDialog
                           ├─ GroupDetailView
                           │   ├─ GroupMembersPanel   (agregar/quitar usuarios)
                           │   └─ GroupRolesPanel     (agregar / quitar → ConfirmImpactDialog con N usuarios afectados)
                           ├─ RolesListView   + RoleFormDialog
                           ├─ RoleDetailView
                           │   └─ PermissionChecklist (Fieldset por resource, Checkbox + description, code solo en tooltip)
                           └─ PermissionsCatalogView
                               └─ Fieldset por resource → DataTable (descripción, roles que lo usan como Tags)

Compartidos (features/security/components):
  Can, RequirePermission, ForbiddenNotice (Message "No tenés permiso para ver esto"),
  ConfirmImpactDialog (Dialog propio, patrón OrderList), ApiErrorState
```

## 7. Config del menú (sin ifs en JSX)

`src/navigation/menuConfig.js`:

```js
export const MENU_CONFIG = [
  { label: 'Delivery3D - Taller', icon: 'pi pi-fw pi-box', items: [
      { label: 'Tablero y Finanzas (Split)', icon: 'pi pi-fw pi-th-large', path: '/' },
      { label: 'Listado de Pedidos', icon: 'pi pi-fw pi-list', path: '/orders' },
      … // perm: undefined = solo requiere login (comportamiento actual)
  ]},
  { label: 'Seguridad', icon: 'pi pi-fw pi-shield', items: [
      { label: 'Usuarios', icon: 'pi pi-fw pi-users',  path: '/seguridad/usuarios', perm: PERM.RBAC_READ },
      { label: 'Grupos',   icon: 'pi pi-fw pi-sitemap', path: '/seguridad/grupos',  perm: PERM.RBAC_READ },
      { label: 'Roles',    icon: 'pi pi-fw pi-id-card', path: '/seguridad/roles',   perm: PERM.RBAC_READ },
      { label: 'Permisos', icon: 'pi pi-fw pi-key',     path: '/seguridad/permisos', perm: PERM.RBAC_READ },
  ]},
];
```

`buildMenu(config, can)` (función pura, testeada): filtra ítems cuyo `perm` no pasa `can`, **descarta grupos que quedan vacíos** (así "Seguridad" aparece solo si se ve al menos un ítem) y mapea `path → to` al formato que espera `AppMenu`. `AppMenu.js` (Babylon) no se modifica. El `breadcrumb` de `App.js` se deriva de la misma config (más las rutas de detalle).

## 8. Reglas transversales

- **403 de la API**: helper `getApiError(err)` → `{ status, message, code }`. En carga de pantalla → `<ForbiddenNotice>` en lugar de la tabla (la pantalla no rompe, el layout sigue). En acción → toast `error` "No tenés permiso para realizar esta acción" + `refresh()` de permisos (puede que te los hayan quitado), que re-renderiza menú y botones. No agrego 403 al interceptor global (no queremos redirigir en cada acción denegada).
- **Después de cualquier mutación** de grupos/roles/asignaciones: `await refresh()` de permisos + `reload()` de los datos de la vista actual (las demás vistas re-fetchean al montar). Si el usuario pierde `rbac:read` como efecto colateral, el guard lo saca a `/access`.
- **Confirmación al quitar un rol a un grupo**: `ConfirmImpactDialog` llama primero al endpoint de impacto (§10.4) y muestra "Afecta a N usuarios (M pierden permisos)" con la lista; recién ahí habilita "Quitar".
- **No quitarse `rbac:manage` a sí mismo**: el front usa el mismo endpoint de impacto (`removes_own_rbac_manage`) para deshabilitar el botón con explicación; en `RoleDetailView` desmarcar `rbac:manage` de un rol que el usuario actual tiene se previsualiza con `.../permissions/impact`. **El backend debe rechazar igual con 409 `SELF_LOCKOUT`**; el front solo muestra el mensaje.
- Motivo obligatorio en rol directo: validación en el form (no vacío, máx. 255) + mostrar el 422 del backend.
- Seguridad OWASP: sin `dangerouslySetInnerHTML` (descripciones y motivos se renderizan como texto), sin persistir permisos, token sigue saliendo solo de `localStorage` por request (patrón `getHeaders`), ningún log del token.

## 9. Estructura de archivos propuesta

```
frontend/src/
├─ navigation/
│  ├─ menuConfig.js                 # MENU_CONFIG + ROUTE_META (breadcrumb)
│  ├─ buildMenu.js
│  └─ buildMenu.test.js
├─ features/security/
│  ├─ securityApi.js                # endpoints /api/rbac/* + getMyPermissions (patrón getHeaders)
│  ├─ securityApi.test.js
│  ├─ apiError.js                   # getApiError(err)
│  ├─ permissions/
│  │  ├─ perms.js                   # PERM espejo del enum backend
│  │  ├─ PermissionsContext.js      # PermissionsProvider + usePermissions
│  │  ├─ PermissionsContext.test.js
│  │  ├─ Can.jsx / Can.test.js
│  │  └─ RequirePermission.jsx / RequirePermission.test.js
│  ├─ components/
│  │  ├─ ForbiddenNotice.jsx
│  │  └─ ConfirmImpactDialog.jsx
│  ├─ users/   UsersListView.jsx, UserDetailView.jsx, UserGroupsTab.jsx, UserDirectRolesTab.jsx, UserEffectiveAccessTab.jsx (+ tests)
│  ├─ groups/  GroupsListView.jsx, GroupDetailView.jsx, GroupFormDialog.jsx (+ tests)
│  ├─ roles/   RolesListView.jsx, RoleDetailView.jsx, RoleFormDialog.jsx, PermissionChecklist.jsx (+ tests)
│  └─ permissions-catalog/ PermissionsCatalogView.jsx (+ test)
```

Archivos existentes que se tocan: `AppWrapper.js` (montar `PermissionsProvider`), `App.js` (menú/breadcrumb desde config + rutas `/seguridad/*`), `pages/Access.js` (español + `<Link>`). `AuthContext.js` y `AppMenu.js` no cambian.

## 10. Contrato de API que necesito del backend

Convenciones (alineadas con lo existente): JSON, `Authorization: Bearer <jwt>`, errores `{"error": "<mensaje en español>", "code": "<MACHINE_CODE>"}` (pido **agregar `code`** para distinguir casos sin parsear texto), 422 con `{"error": "...", "errors": {"campo": "msg"}}`. Códigos comunes a todos: **401** sin/ token inválido, **403** `{"error":"Acceso denegado: permisos insuficientes","code":"FORBIDDEN"}`, **404** `NOT_FOUND`, **422** `VALIDATION_ERROR`, **409** conflictos. Lecturas `/api/rbac/*` requieren `rbac:read`; escrituras `rbac:manage`. Fechas ISO-8601 UTC.

### 10.1 Mis permisos

`GET /api/auth/me/permissions` (en `auth_bp`, solo `login_required`)

```json
200
{
  "user_id": 7,
  "is_superuser": false,
  "permissions": ["ordenes:delete", "rbac:manage", "rbac:read"]
}
```
- Lista **plana y efectiva** (unión directos + vía grupos, sin duplicados, ordenada). Si `is_superuser`, `permissions` puede venir completa o vacía: el front ignora la lista.
- Errores: 401.

### 10.2 Usuarios

`GET /api/rbac/users?q=ana&page=1&per_page=20`
```json
200
{ "items": [ { "id": 7, "username": "ana", "is_active": true, "is_superuser": false,
               "groups_count": 2, "direct_roles_count": 1 } ],
  "total": 1, "page": 1, "per_page": 20 }
```
(`q` busca por username, case-insensitive; `per_page` máx. 100.)

`GET /api/rbac/users/{user_id}`
```json
200 { "id": 7, "username": "ana", "is_active": true, "is_superuser": false, "created_at": "2026-10-01T12:00:00Z" }
```

`GET /api/rbac/users/{user_id}/groups`
```json
200 [ { "id": 3, "name": "Operadores", "description": "Turno mañana" } ]
```
`POST /api/rbac/users/{user_id}/groups` body `{ "group_id": 3 }` → `201 { "user_id": 7, "group_id": 3 }` · 409 `ALREADY_MEMBER` · 404.
`DELETE /api/rbac/users/{user_id}/groups/{group_id}` → `204` · 409 `SELF_LOCKOUT` · 404.

`GET /api/rbac/users/{user_id}/roles` (solo directos)
```json
200 [ { "role": { "id": 5, "name": "Auditor" },
        "assigned_by": { "id": 1, "username": "admin" },
        "assigned_at": "2026-11-10T14:03:00Z",
        "reason": "Cubre auditoría de caja de noviembre" } ]
```
`POST /api/rbac/users/{user_id}/roles` body `{ "role_id": 5, "reason": "texto" }` → `201` (mismo objeto de arriba) · 422 si `reason` vacío/>255 · 409 `ALREADY_ASSIGNED` · 404. `assigned_by` lo toma el backend de `g.current_user` (nunca del body).
`DELETE /api/rbac/users/{user_id}/roles/{role_id}` → `204` · 409 `SELF_LOCKOUT`.

`GET /api/rbac/users/{user_id}/effective-access`
```json
200
{ "user_id": 7, "is_superuser": false,
  "permissions": [
    { "code": "ordenes:delete", "resource": "ordenes", "description": "Eliminar pedidos",
      "sources": [
        { "type": "group", "group": { "id": 3, "name": "Operadores" }, "role": { "id": 2, "name": "Encargado" } },
        { "type": "direct", "role": { "id": 5, "name": "Auditor" } }
      ] } ] }
```

### 10.3 Grupos

`GET /api/rbac/groups?q=` → `200 [ { "id": 3, "name": "Operadores", "description": "…", "members_count": 4, "roles_count": 1 } ]`
`POST /api/rbac/groups` `{ "name": "Operadores", "description": "…" }` → `201 {grupo}` · 409 `NAME_TAKEN` · 422.
`GET /api/rbac/groups/{id}` → `200 {grupo}` ; `PUT /api/rbac/groups/{id}` (mismo body) → `200` ; `DELETE /api/rbac/groups/{id}` → `204` · 409 `SELF_LOCKOUT`.
`GET /api/rbac/groups/{id}/members` → `200 [ { "id": 7, "username": "ana", "is_active": true } ]`
`POST /api/rbac/groups/{id}/members` `{ "user_id": 7 }` → `201` ; `DELETE /api/rbac/groups/{id}/members/{user_id}` → `204` · 409 `SELF_LOCKOUT`.
`GET /api/rbac/groups/{id}/roles` → `200 [ { "id": 2, "name": "Encargado", "description": "…" } ]`
`POST /api/rbac/groups/{id}/roles` `{ "role_id": 2 }` → `201` · 409 `ALREADY_ASSIGNED`.
`DELETE /api/rbac/groups/{id}/roles/{role_id}` → `204` · 409 `SELF_LOCKOUT`.

### 10.4 Impacto previo (usuarios afectados + auto-bloqueo)

`GET /api/rbac/groups/{id}/roles/{role_id}/removal-impact`
```json
200
{ "affected_users_count": 4,
  "users_losing_permissions_count": 2,
  "affected_users": [
    { "id": 7, "username": "ana", "lost_permissions": ["ordenes:delete"] },
    { "id": 9, "username": "beto", "lost_permissions": [] } ],
  "removes_own_rbac_manage": false }
```
- `affected_users_count` = miembros del grupo; `users_losing_permissions_count` = los que dejan de tener algún permiso (porque no lo tienen por otra vía). `lost_permissions` contempla otras fuentes.
- Mismo shape, para reutilizar `ConfirmImpactDialog`:
  - `GET /api/rbac/groups/{id}/members/{user_id}/removal-impact`
  - `GET /api/rbac/users/{user_id}/roles/{role_id}/removal-impact`
  - `GET /api/rbac/groups/{id}/removal-impact` y `GET /api/rbac/roles/{id}/removal-impact` (borrado)
  - `POST /api/rbac/roles/{id}/permissions/impact` body `{ "permissions": ["rbac:read"] }` (preview del nuevo set).
- Solo lectura (`rbac:read`), sin efectos.
- **Regla de auto-bloqueo en backend (obligatoria, no solo UX):** toda mutación que deje a `g.current_user` (no superuser) sin `rbac:manage` efectivo debe responder `409 {"error":"No podés quitarte a vos mismo el permiso de administrar seguridad","code":"SELF_LOCKOUT"}` y hacer rollback. Aplica a: quitar miembro, quitar rol de grupo, quitar rol directo, borrar grupo/rol, reemplazar permisos de rol. Sugerencia extra: impedir que quede **ningún** usuario con `rbac:manage` (409 `LAST_ADMIN`).

### 10.5 Roles

`GET /api/rbac/roles?q=` → `200 [ { "id": 2, "name": "Encargado", "description": "…", "permissions_count": 6, "groups_count": 1, "direct_users_count": 0 } ]`
`POST /api/rbac/roles` `{ "name": "Encargado", "description": "…" }` → `201` · 409 `NAME_TAKEN`.
`GET /api/rbac/roles/{id}` → `200 { "id": 2, "name": "Encargado", "description": "…", "permissions": ["ordenes:delete", "rbac:read"] }`
`PUT /api/rbac/roles/{id}` `{ "name": "…", "description": "…" }` → `200`.
`DELETE /api/rbac/roles/{id}` → `204` · 409 `SELF_LOCKOUT` · 409 `ROLE_IN_USE` (si el backend decide no permitir borrar roles asignados; a definir).
`PUT /api/rbac/roles/{id}/permissions` `{ "permissions": ["ordenes:delete", "rbac:read"] }` (reemplazo completo, codes válidos del enum) → `200 {rol}` · 422 `UNKNOWN_PERMISSION` · 409 `SELF_LOCKOUT`.

### 10.6 Catálogo de permisos (solo lectura)

`GET /api/rbac/permissions`
```json
200
[ { "resource": "ordenes", "resource_label": "Pedidos",
    "permissions": [
      { "code": "ordenes:delete", "action": "delete", "description": "Eliminar pedidos",
        "roles": [ { "id": 2, "name": "Encargado" } ] } ] },
  { "resource": "rbac", "resource_label": "Seguridad", "permissions": [ … ] } ]
```
Lo usan `PermissionsCatalogView` y `PermissionChecklist` (descripción visible, code solo como tooltip). Sin POST/PUT/DELETE (el catálogo sale del enum).

## 11. Estrategia de tests (jest + Testing Library, `npm test -- --watchAll=false`)

TDD (Red → Green → Refactor) en la base de permisos, que es lógica de autorización:

| Archivo | Casos |
|---|---|
| `PermissionsContext.test.js` | sin token → no llama a la API, `can` false; con token → llama `getMyPermissions` y `can` true/false según lista; `is_superuser` → `can`/`canAny` true para cualquier PERM; `canAny` con uno, varios, ninguno; error de carga → fail-closed (`status:'error'`, `can` false); logout limpia; `refresh()` re-consulta; warning en dev con string fuera de `PERM`. (`renderHook` con wrapper `AuthProvider`+`PermissionsProvider`, `jest.mock('../securityApi')` y `../../auth/authApi`.) |
| `Can.test.js` | renderiza children con permiso; `fallback` sin permiso; `anyOf`; superuser; nada mientras `loading`. |
| `RequirePermission.test.js` | `MemoryRouter` con `/seguridad/roles` y `/access`: con permiso renderiza; sin permiso navega a `/access` (verifica texto de la página); `loading` muestra spinner y no redirige; superuser pasa. |
| `buildMenu.test.js` | filtra por permiso; grupo "Seguridad" ausente si no ve ningún ítem; presente si ve uno; ítems sin `perm` siempre visibles; mapea `path → to`. |
| `securityApi.test.js` | headers con/sin token (como `authHeaders.test.js`), paths y bodies correctos. |
| Vistas | 403 en la carga → muestra `ForbiddenNotice` sin romper; botones de mutación ocultos sin `RBAC_MANAGE`; motivo obligatorio deshabilita "Asignar"; `ConfirmImpactDialog` muestra el conteo; `removes_own_rbac_manage` deshabilita "Quitar"; tras mutación se llama `refresh()`; 409 `SELF_LOCKOUT` → toast con el mensaje del backend. |

`App.test.js` actual debe seguir pasando (el provider sin token no hace requests).

## 12. Riesgos y decisiones

1. **Convivencia con `user.role` / `roles_required`**: el backend hoy autoriza por `role` (`admin`/`operator`). Hasta que migre a `Perm`, el menú del taller queda sin `perm` (visible con login). Cuando el backend migre, se agrega `perm` en la config sin tocar JSX.
2. **403 ≠ redirect global**: se maneja por pantalla para no romper flujos (decisión deliberada).
3. **Cache de permisos solo en memoria** → un request extra por carga de app; aceptable.
4. **Permisos revocados en otra sesión**: el front se entera en el próximo 403 (dispara `refresh()`) o recarga. Se podría agregar refresh al volver el foco a la pestaña (opcional).
5. **axios 0.19** con CVEs: fuera de alcance, anotado.
6. **Mantenimiento manual de `PERM`**: riesgo de divergencia; mitigado con warning en dev y (opcional) test cruzado en backend.
7. `pages/Access.js` es pública y full-page: al ir a 403 se pierde el menú. Ver pregunta 1.
