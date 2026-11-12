# Proposal: rbac-access-control

- **Domain:** `auth` (folder in `openspec/specs/auth/`)
- **Reference Ticket / Issue:** n/a (pedido directo del usuario, trabajo por etapas)

## Why
Hoy la autorización de Delivery3D es binaria: cualquier usuario autenticado y activo puede hacer **todo**. Existe `users.role` (`'admin'` / `'operator'`) y un decorador `roles_required(*roles)` en `backend/app/auth/security.py`, pero **ninguna ruta lo usa**: todas las rutas de `orders`, `cashbox`, `printers`, `settings`, `materials` y `filaments` llevan solo `@login_required`. Consecuencias concretas:

- Cualquier operador puede borrar pedidos en cualquier estado (`DELETE /api/orders/<id>`, spec `openspec/archive/2026-09-18-order-deletion/spec-delta.md`), registrar egresos de caja, cambiar la configuración del taller (costo kWh, margen) o editar impresoras.
- No hay forma de dar a un usuario un acceso parcial (ej. "solo ve y cotiza pedidos, no toca caja") sin tocar código.
- Un único string `role` por usuario no escala: no permite pertenecer a varios equipos ni dar excepciones puntuales con trazabilidad.

Si no hacemos nada, al sumar un segundo operador (o un ayudante) la única opción es darle acceso total al dinero y a la configuración.

## What Changes
Se reemplaza el control por `users.role` por un **RBAC mixto** resuelto en cada request contra la base:

- Los **permisos** (`recurso:acción`) son un catálogo definido en código (`backend/app/rbac/constants.py`, `class Perm(StrEnum)` + `PERM_DESCRIPTIONS`) y sincronizado a la tabla `permissions` por seed. No se crean desde UI/API.
- Los permisos **nunca** se asignan a usuarios: pertenecen a **roles** (`role_permissions`).
- Un usuario obtiene roles por dos caminos: **grupos** (`user_groups` → `groups` → `group_roles`) y **asignación directa** (`user_roles`, pensada para excepciones, con `reason` obligatorio y auditoría).
- Permisos efectivos = unión de ambos caminos. Solo suman; sin denegaciones, sin jerarquía de roles, sin comodines.
- `users.is_superuser` habilita todo sin consultar roles.
- El JWT pasa a llevar solo la identidad (`sub` = user_id); los permisos se resuelven por request y se cachean en `flask.g`.
- Las rutas se protegen con `@permission_required(Perm.X, ...)`.

### Etapas (cada una se aprueba antes de pasar a la siguiente)
| # | Etapa | Entregable |
|---|---|---|
| 1 | Modelo | `design.md` con diagrama ER de las 8 tablas, conflictos y preguntas (este documento + design). Sin código. |
| 2 | Migración | Modelos SQLAlchemy en `backend/app/rbac/models.py` + migración Alembic aditiva (tablas nuevas, `users.is_superuser`, `users.updated_at` si se aprueba) + migración de datos de `users.role`. |
| 3 | Catálogo y seed | `backend/app/rbac/constants.py` (`Perm`, `PERM_DESCRIPTIONS`) y `seeds/seed_permissions.py` idempotente (+ roles/grupos iniciales si se aprueban). |
| 4 | Tests en rojo | `backend/tests/rbac/`: resolución de permisos (grupo, directo, unión, superuser, inactivo), decorador 401/403, cache por request, convenciones del catálogo. |
| 5 | Implementación | `backend/app/rbac/services.py` (`get_user_permissions`), `permission_required(*perms)` y aplicación de `Perm.X` en todos los blueprints existentes. |
| 6 | Endpoints de administración | Blueprint `/api/rbac`: CRUD de roles y grupos, membresías, asignaciones directas, lectura del catálogo de permisos, `GET /api/rbac/users/<id>/access` con el origen de cada rol. Todo con `Perm.RBAC_MANAGE`; nadie se asigna roles ni grupos a sí mismo. |
| 7 | Frontend | `frontend/src/features/rbac/`: pantallas de roles, grupos y accesos de usuario; ocultar acciones sin permiso (ej. botón de borrar pedido); consumir la lista de permisos efectivos del usuario actual. |

## Capabilities
- **New capabilities:**
  - Definir roles con un conjunto de permisos del catálogo.
  - Definir grupos con roles y agregar usuarios a varios grupos.
  - Asignar un rol directo a un usuario como excepción, con motivo obligatorio y registro de quién y cuándo.
  - Consultar el acceso efectivo de un usuario y de dónde viene cada rol (grupo X / directo).
  - Marcar usuarios como superusuario.
- **Modified capabilities:**
  - Todas las rutas de negocio pasan de `@login_required` a `@permission_required(...)` (403 si falta el permiso).
  - `DELETE /api/orders/<id>` deja de estar disponible para "cualquier operador autenticado": requiere `orders:delete` (modifica la spec archivada de order-deletion; se registra un `spec-delta.md` con el requisito MODIFICADO).
  - El JWT deja de transportar `role` y `username` (solo `sub`).
- **Removed capabilities:**
  - `roles_required(*roles)` y la semántica de `users.role` para autorizar (la columna se depreca; su eliminación física se decide en la pregunta correspondiente del design).

## Out of Scope
- Gestión de usuarios (alta/baja/reset de contraseña): hoy los usuarios se crean por seed; no se agrega un ABM de usuarios en este cambio (solo `is_superuser` vía administración si se aprueba).
- Permisos por objeto / ownership ("solo mis pedidos").
- Denegaciones explícitas, jerarquía/herencia de roles, comodines (`orders:*`).
- Multi-tenant / multi-taller.
- Creación de permisos desde UI o API.
- Cache de permisos entre requests (Redis, memoria de proceso) o permisos embebidos en el JWT.
- Revocación inmediata de tokens emitidos (no aplica: los permisos se resuelven por request, así que un cambio de rol impacta en el siguiente request sin invalidar el token).
- Nuevas dependencias Python o npm.
