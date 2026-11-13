# Design: rbac-access-control

> **Estado:** Etapas 1 y 2 aprobadas; migración `44a4db68ccde` aplicada en desarrollo. Etapa 3 implementada (catálogo + seed); seed **no aplicado** a desarrollo (solo `--dry-run`).
> Contrato de API: fuente única en `api-contract.md` (**cerrado** en etapa 6). Etapas 4–6 implementadas (ver secciones).

## Respuestas del usuario (etapa 1)

| # | Decisión |
|---|---|
| P1 | Opción (a): `admin → is_superuser = 1`; `operator → is_superuser = 0`. El seed (etapa 3) crea el grupo **"Operadores"** con el rol **"Operador"** = todos los permisos de negocio **menos** `rbac:manage` y **menos** `orders:delete`. |
| P2 | Se agrega `users.updated_at`, backfill `= created_at`. |
| P3 | `user_roles` usa `assigned_at`/`assigned_by` (en lugar de `created_*`) + `updated_at`/`updated_by`. |
| P4 | ON DELETE aprobados tal cual: grupo CASCADE en puentes; rol en uso RESTRICT → 409 `ROLE_IN_USE`. |
| P5 | Se mantiene `groups`; SQL crudo con backticks (incluido `conftest.py`). |
| P6 | `permission_required(A, B)` = AND (todos). |
| P7 | `is_superuser` **no** se modifica por API; solo seed/CLI. |
| P8 | Se autoriza modificar `conftest.py` (`is_superuser=True` en id=1, truncado de tablas nuevas con backticks). Ningún test existente se cambia. |
| P9 | `users.role` queda deprecada y sigue en login y `/me`; se borra en un cambio futuro. |
| P10 | Usuario inactivo → 401 aunque sea superusuario. |

Decisiones adicionales acordadas con el plan de frontend (`frontend-plan.md`):
- Permisos de la sección de seguridad: solo `rbac:read` (lecturas) y `rbac:manage` (escrituras). No hay `rbac:users:read`.
- Errores con `code` además de `error`: `SELF_LOCKOUT` (409), `ROLE_IN_USE` (409), `SELF_ASSIGNMENT`.
- **No** hay bloqueo `LAST_ADMIN` (lo cubre el superusuario).
- Listado de usuarios sin paginación.
- Acceso efectivo: `GET /api/rbac/users/<id>/access` (no `/effective-access`).
- Habrá un test backend que compare `frontend/src/features/security/permissions/perms.js` con el enum `Perm` (etapa 3 o 4). Formato acordado: una entrada por línea dentro de `export const PERM = Object.freeze({ ... })`, `NOMBRE_MIEMBRO: 'recurso:acción',`, con nombres iguales a los miembros del enum Python.
- `GET /api/auth/me/permissions` es contrato **fijo** (el frontend ya lo consume): ver `api-contract.md` §1.
- `orders:read` existe en el catálogo (etapa 3); los recursos usan el nombre del endpoint en inglés (`orders`, no `ordenes`).

## Etapa 2 — Migración (hecho)

- `backend/app/auth/models.py`: `User.is_superuser` (`BOOL NOT NULL DEFAULT 0`), `User.updated_at` (`DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, `onupdate`). `role` marcada deprecada en comentario; `to_dict()` sin cambios.
- `backend/app/rbac/__init__.py`, `backend/app/rbac/models.py`: `Group`, `Role`, `Permission`, `UserGroup`, `GroupRole`, `UserRole`, `RolePermission`. Sin relationships ORM todavía (se agregan en etapa 5 si las consultas lo requieren).
- `backend/app/__init__.py`: importa `app.rbac.models` (necesario para `create_all` y autogenerate).
- `backend/migrations/versions/44a4db68ccde_add_rbac_tables.py` (`down_revision = c8c9b0e3a953`): escrita a mano (no autogenerate, para no conectar a la base real). Incluye backfill `is_superuser` y `updated_at`. Downgrade: `DROP TABLE` en orden inverso + `drop_column` de las 2 columnas de `users` (los índices caen con la tabla; dropearlos antes fallaría porque MySQL los exige para las FK).
- Paridad modelo ↔ migración verificada compilando el DDL de los modelos con el dialecto MySQL: mismos nombres de FK (`fk_<tabla>_<col>`), `ondelete`, UNIQUE, CHECK, índices y `server_default`.
- Timestamps nuevos con `server_default CURRENT_TIMESTAMP` además del default Python, para que filas insertadas por SQL crudo (seed/migración) no fallen.
- `backend/tests/conftest.py`: usuario id=1 con `is_superuser=True`; `_clean_tables` trunca las 7 tablas nuevas y usa backticks en todos los `TRUNCATE`.
- SQL offline generado y revisado (sin aplicar): `flask db upgrade c8c9b0e3a953:44a4db68ccde --sql` y `flask db downgrade 44a4db68ccde:c8c9b0e3a953 --sql`. Contiene 2 CHECK, 16 índices secundarios, 20 FK con `ON DELETE` explícito y los 2 `UPDATE users` de backfill.
- Suite completa con modelos nuevos sobre la base de test: **234 passed** (verificado en el worktree `feat/rbac`).
- ⚠️ **Despliegue:** el contenedor `delivery3d-backend` monta el repo en vivo. Cambiar `User` sin aplicar la migración rompe el login (`Unknown column users.is_superuser`). Por eso el trabajo vive en el worktree `.worktrees/rbac` (rama `feat/rbac`) y el orden de despliegue es: **primero `flask db upgrade`, después el código**.
- ⚠️ El downgrade borra `is_superuser`/`updated_at` y todas las asignaciones RBAC (pérdida de datos esperable en un downgrade de tablas nuevas). `users.role` no se toca, así que un re-upgrade reconstruye `is_superuser` desde `role`.

## Respuestas del usuario (etapa 2 → preguntas abiertas del contrato)

| # | Decisión |
|---|---|
| Q1 | Se bloquea también la autoescalada indirecta con `SELF_ASSIGNMENT`: agregar un rol a un grupo del que el actor es miembro, o sumar permisos a un rol que el actor ya tiene. Regla completa en `api-contract.md` §0. |
| Q2 | `SELF_ASSIGNMENT` = 409, como `SELF_LOCKOUT`. |
| Q3 | Las etiquetas las da el backend: `RESOURCE_LABELS` en `constants.py`, expuestas como `resource_label` en `GET /api/rbac/permissions`. |
| Q4 | Los endpoints de impacto entran en la etapa 6. |

Estado de la etapa 2: el usuario aprobó el SQL; la migración `44a4db68ccde` está aplicada en la base de desarrollo y commiteada en `feat/rbac` (`d44f18e`).

## Etapa 3 — propuesta de catálogo (APROBADA; ver "Etapa 3 — catálogo y seed" para lo final)

### Relevamiento: 32 endpoints existentes en 7 blueprints (+ `rbac` en etapa 6)
| Blueprint | Endpoints |
|---|---|
| `orders` (12) | `POST ""`, `PUT /<id>`, `GET ""`, `GET /<id>`, `POST /<id>/quote` (calcula, no cambia estado), `POST /<id>/quote/confirm` (nuevo→presupuestado con precio informado), `POST /<id>/approve` (opcional `deposit_amount` → **crea movimiento de caja "seña"**), `POST /<id>/start-printing`, `POST /<id>/mark-ready`, `POST /<id>/deliver` (opcional `collect_balance` → **crea movimiento de caja "saldo"**), `GET /<id>/history`, `DELETE /<id>` |
| `cashbox` (11) | `GET/POST /categories/income`, `PUT /categories/income/<id>`, `GET/POST /categories/expense`, `PUT /categories/expense/<id>`, `GET /summary`, `GET/POST /movements`, `GET /orders/<id>/balance`, `POST /orders/<id>/collect-balance` |
| `printers` (3) | `GET ""`, `POST ""`, `PUT /<id>` |
| `settings` (2) | `GET ""`, `PUT ""` |
| `materials` (1) / `filaments` (1) | `GET ""` |
| `auth` (2 + 1 nuevo) | `POST /login` (público), `GET /me`, `GET /me/permissions` (nuevo, etapa 5): **solo `login_required`, sin permiso** |
| `rbac` (etapa 6) | Lecturas → `rbac:read`; escrituras → `rbac:manage` |

No existen endpoints de borrado (salvo pedidos) ni de cancelación: **no se crean permisos sin endpoint** (no hay `printers:delete`, `cash_movements:delete`, etc.). Si mañana se agrega el endpoint, se agrega el permiso.

### Catálogo `Perm` propuesto (22 permisos)

Miembro del enum = `RESOURCE_ACTION` en mayúsculas (`Perm.ORDERS_READ = "orders:read"`), igual nombre en `perms.js`.

| # | `code` | resource | action | Descripción (`PERM_DESCRIPTIONS`) | Endpoints que protege | Operador |
|---|---|---|---|---|---|---|
| 1 | `orders:read` | orders | read | Ver pedidos, su detalle e historial de estados | `GET /api/orders`, `GET /api/orders/<id>`, `GET /api/orders/<id>/history` | ✅ |
| 2 | `orders:create` | orders | create | Cargar pedidos nuevos (y clientes nuevos desde el alta) | `POST /api/orders` | ✅ |
| 3 | `orders:update` | orders | update | Editar las piezas y el cliente de un pedido | `PUT /api/orders/<id>` | ✅ |
| 4 | `orders:delete` | orders | delete | Eliminar pedidos definitivamente (en cualquier estado) | `DELETE /api/orders/<id>` | ❌ |
| 5 | `orders:quote` | orders | quote | Calcular y confirmar el presupuesto de un pedido | `POST /api/orders/<id>/quote`, `POST /api/orders/<id>/quote/confirm` | ✅ |
| 6 | `orders:approve` | orders | approve | Aprobar un pedido presupuestado y registrar la seña | `POST /api/orders/<id>/approve` | ✅ |
| 7 | `orders:produce` | orders | produce | Avanzar la producción: pasar a imprimiendo y a listo | `POST /api/orders/<id>/start-printing`, `POST /api/orders/<id>/mark-ready` | ✅ |
| 8 | `orders:deliver` | orders | deliver | Entregar un pedido y cobrar el saldo | `POST /api/orders/<id>/deliver` | ✅ |
| 9 | `cash_movements:read` | cash_movements | read | Ver el saldo de caja, los movimientos y el saldo de cada pedido | `GET /api/cashbox/summary`, `GET /api/cashbox/movements`, `GET /api/cashbox/orders/<id>/balance` | ✅ |
| 10 | `cash_movements:create` | cash_movements | create | Registrar ingresos y egresos de caja, incluido el cobro de saldos | `POST /api/cashbox/movements`, `POST /api/cashbox/orders/<id>/collect-balance` | ✅ |
| 11 | `cash_categories:read` | cash_categories | read | Ver las categorías de ingresos y egresos | `GET /api/cashbox/categories/income`, `GET /api/cashbox/categories/expense` | ✅ |
| 12 | `cash_categories:create` | cash_categories | create | Crear categorías de ingresos y egresos | `POST /api/cashbox/categories/income`, `POST /api/cashbox/categories/expense` | ✅ |
| 13 | `cash_categories:update` | cash_categories | update | Editar y activar/desactivar categorías de ingresos y egresos | `PUT /api/cashbox/categories/income/<id>`, `PUT /api/cashbox/categories/expense/<id>` | ✅ |
| 14 | `printers:read` | printers | read | Ver las impresoras del taller | `GET /api/printers` | ✅ |
| 15 | `printers:create` | printers | create | Dar de alta impresoras | `POST /api/printers` | ✅ |
| 16 | `printers:update` | printers | update | Editar y activar/desactivar impresoras | `PUT /api/printers/<id>` | ✅ |
| 17 | `settings:read` | settings | read | Ver la configuración del taller | `GET /api/settings` | ✅ |
| 18 | `settings:update` | settings | update | Cambiar la configuración del taller (costos, margen, moneda) | `PUT /api/settings` | ✅ |
| 19 | `materials:read` | materials | read | Ver el catálogo de materiales | `GET /api/materials` | ✅ |
| 20 | `filaments:read` | filaments | read | Ver el catálogo de tipos de filamento | `GET /api/filaments` | ✅ |
| 21 | `rbac:read` | rbac | read | Ver usuarios, grupos, roles, permisos y accesos | `GET /api/rbac/*` (etapa 6) | ❌ (ver pregunta E3-2) |
| 22 | `rbac:manage` | rbac | manage | Administrar grupos, roles y asignaciones de acceso | `POST/PUT/DELETE /api/rbac/*` (etapa 6) | ❌ |

### Criterios aplicados
- **Recursos = nombre del endpoint en inglés y plural.** `cashbox` es un módulo, no un recurso: sus sub-recursos son `movements` y `categories`. Se prefijan con `cash_` (`cash_movements`, `cash_categories`) para que el code se entienda solo, y coinciden con las tablas `cash_movements` / `cash_*_categories`. `settings` y `rbac` quedan como en el prefijo del endpoint. Ver pregunta E3-1.
- **Acciones de negocio solo con consecuencias distintas:**
  - `quote` fija el precio que se le informa al cliente.
  - `approve` puede **mover plata** (seña), igual que `deliver` (saldo). Están separadas de `produce`, que solo cambia el estado del taller.
  - `start-printing` y `mark-ready` comparten `produce`: misma consecuencia (avance interno), no un permiso por endpoint.
- **Income y expense comparten permiso** (`cash_movements:create`, `cash_categories:*`): mismo endpoint, mismo impacto contable. Separar "registrar egresos" sería un permiso por campo `type`; si se necesita, se agrega como acción de negocio (`cash_movements:create_expense`) en otro cambio.
- **`approve` y `deliver` no exigen además `cash_movements:create`.** La seña y el cobro del saldo son parte de la transición: quien puede aprobar o entregar puede registrar esos ingresos. La alternativa (chequeo condicional si viene `deposit_amount` / `collect_balance`) mete lógica de autorización dentro del route. Ver pregunta E3-3.
- `materials:read` y `filaments:read` están separados aunque el formulario de pedidos necesita ambos: son recursos con endpoint propio. Si en el futuro hay ABM de materiales, se suma `materials:create/update`.
- Sin comodines, sin ownership, sin nombres de áreas. `code` inmutable: renombrar = permiso nuevo + migración de datos.

### `RESOURCE_LABELS` (orden = orden de presentación en el catálogo)
| resource | label |
|---|---|
| `orders` | Pedidos |
| `cash_movements` | Movimientos de caja |
| `cash_categories` | Categorías de caja |
| `printers` | Impresoras |
| `settings` | Configuración del taller |
| `materials` | Materiales |
| `filaments` | Filamentos |
| `rbac` | Seguridad |

### Rol "Operador" (grupo "Operadores") — SUPERADO por E3-4: el final tiene 14 permisos
20 permisos: todo el catálogo **menos `orders:delete` y `rbac:manage`**, y en esta propuesta también **menos `rbac:read`** (no es un permiso de negocio). Queda: los 1–3 y 5–20 de la tabla.
Constante en código: `OPERATOR_ROLE_PERMS: frozenset[Perm]`, definida como `set(Perm) - {ORDERS_DELETE, RBAC_READ, RBAC_MANAGE}`, para que un permiso de negocio nuevo entre solo en el rol al re-crearlo (ver seed).

### Diseño del seed (`backend/seeds/seed_rbac.py`, sin escribir todavía)
La lógica vive en `backend/app/rbac/services.py` (`sync_permission_catalog()`, `bootstrap_operator_group()`), así los tests la llaman directo sobre `create_all`. El script de `seeds/` es un wrapper delgado, igual que `seed_operator.py`.

1. **Catálogo (upsert por `code`), en una transacción:**
   - Por cada miembro de `Perm`: si el `code` no existe → `INSERT` (`resource`/`action` salen de `code.split(":")`, más la descripción de `PERM_DESCRIPTIONS`).
   - Si existe → solo `UPDATE description` cuando cambió. `code`, `resource` y `action` no se tocan: son inmutables y el CHECK los ata.
   - Reporta `creados=N actualizados=M sin_cambios=K`.
2. **Huérfanos** (filas de `permissions` cuyo `code` ya no está en `Perm`):
   - Se **listan, nunca se borran** (la FK `RESTRICT` y la regla de inmutabilidad piden una migración consciente).
   - Salida: `HUÉRFANO orders:foo — usado por roles: Operador, Encargado` (un `JOIN` con `role_permissions`/`roles`).
   - Exit code 0 con warning; con `--strict`, exit 1 (para CI).
3. **Bootstrap "Operadores"/"Operador"** (solo si no existen, por `name` UNIQUE):
   - Rol "Operador": si **no existe**, se crea con `description` y se le cargan `OPERATOR_ROLE_PERMS`. Si **ya existe**, **no se toca**: así se respetan los cambios hechos desde la UI. Se informa la diferencia contra `OPERATOR_ROLE_PERMS` (`faltan: …`, `sobran: …`).
   - Grupo "Operadores": si no existe, se crea y se le vincula el rol "Operador" (`group_roles`). Si existe y no tiene el rol, **no** se re-vincula (mismo criterio: la UI manda).
   - **Membresía inicial (P1):** solo al **crear** el grupo, se agregan todos los usuarios con `role = 'operator'` y `is_superuser = 0`. Es el único uso de la columna deprecada `role`. En corridas posteriores no se re-agrega a nadie, para no deshacer bajas hechas por un administrador.
   - Auditoría: `created_by`/`updated_by` = `NULL` ("sistema").
4. **Transacción:** todo en un `commit()`; ante cualquier excepción, `rollback()` y exit 1.
5. **`--dry-run`:** ejecuta todo, imprime el reporte y hace `rollback()` en lugar de `commit()`.
6. **Cómo se corre:**
   ```bash
   cd backend && PYTHONPATH=. .venv/bin/python -m seeds.seed_rbac --dry-run   # revisar
   cd backend && PYTHONPATH=. .venv/bin/python -m seeds.seed_rbac             # aplicar
   ```
   Orden en un entorno nuevo: `flask db upgrade` → `seeds.seed_operator` → `seeds.seed_rbac`. Re-correrlo es seguro: idempotente.
7. **Ajuste a `seeds/seed_operator.py`:** además de `role="admin"`, setear `is_superuser=True`. Si no, un entorno nuevo creado después de la migración queda sin superusuario, porque el backfill de la migración ya corrió.

### Tests que se escriben en etapa 4 para el catálogo
- Todo `Perm` cumple `^[a-z][a-z_]*:[a-z][a-z_]*$` y el nombre del miembro es `code.upper().replace(":", "_")`.
- Todo `Perm` tiene descripción no vacía; todo `resource` tiene entrada en `RESOURCE_LABELS`, y no sobran labels.
- No hay comodines (`*`) ni acciones fuera de `read/create/update/delete` + lista blanca de acciones de negocio (`quote`, `approve`, `produce`, `deliver`, `manage`).
- `OPERATOR_ROLE_PERMS` no contiene `orders:delete`, `rbac:manage` ni `rbac:read`.
- Seed: idempotencia (2 corridas = mismo estado), descripción actualizada, huérfano listado y no borrado, rol existente no modificado, membresía inicial solo de `role='operator'`.
- Sincronía con `frontend/src/features/security/permissions/perms.js` (formato acordado en `api-contract.md` §7). Si el archivo no existe, el test **falla** (es un monorepo).

### Preguntas de la etapa 3
- **E3-1:** ¿`cash_movements` / `cash_categories` como recursos de `/api/cashbox/...`? Alternativa: `movements` / `categories` a secas (más pegado al path, pero ambiguo).
- **E3-2:** ¿"Operador" sin `rbac:read`? Propuesta: sin. Los operadores no ven la sección Seguridad.
- **E3-3:** ¿`approve` con seña y `deliver` con cobro alcanzan solos, o además exigen `cash_movements:create`? Propuesta: alcanzan solos.
- **E3-4:** el "Operador" queda con `settings:update`, `printers:create/update` y `cash_categories:create/update`. Es lo que pide la regla ("todo menos …") y preserva el acceso actual, pero es configuración sensible: cambia costos y margen. ¿Lo dejamos así o los sacamos del rol ahora?
- **E3-5:** ¿Nombre `orders:produce` para imprimiendo/listo? Alternativa: `orders:advance`.

## Etapa 3 — catálogo y seed (HECHO)

### Respuestas del usuario (E3-1 … E3-5)
| # | Decisión |
|---|---|
| E3-1 | Recursos `cash_movements` y `cash_categories`. |
| E3-2 | "Operador" sin `rbac:read`. |
| E3-3 | `orders:approve` (seña) y `orders:deliver` (saldo) alcanzan solos; no exigen `cash_movements:create`. |
| E3-4 | El Operador **no** cambia precios ni configuración: se le sacan `settings:update`, `printers:create`, `printers:update`, `cash_categories:create`, `cash_categories:update`. Elegir la impresora de cada pedido ya está cubierto por `orders:quote` + `printers:read`. La impresora por defecto del taller (`default_printer_id` en `PUT /api/settings`) queda bajo `settings:update`; no se crea un permiso nuevo. |
| E3-5 | Se queda `orders:produce`. |

### Catálogo final: 22 permisos (`backend/app/rbac/constants.py`)
Es la tabla de "Etapa 3 — propuesta de catálogo", sin cambios de códigos. Solo se ajustaron dos descripciones:
- `orders:quote`: "… (incluye elegir la impresora)".
- `settings:update`: "… (costos, margen, moneda, impresora por defecto)".

### Rol "Operador" final: 14 permisos, lista **explícita** (`OPERATOR_ROLE_PERMS`)
`orders:read`, `orders:create`, `orders:update`, `orders:quote`, `orders:approve`, `orders:produce`, `orders:deliver`, `cash_movements:read`, `cash_movements:create`, `cash_categories:read`, `printers:read`, `settings:read`, `materials:read`, `filaments:read`.

Se define como `frozenset` literal, no como "todo menos…": un permiso nuevo **no** se suma solo.

### Verificación del flujo de presupuesto (E3-4)
- `POST /api/orders/<id>/quote` → `calculate_quote()` guarda `quote_vars["printer_id"]` en `order_quotes.printer_id` (`backend/app/orders/services.py:238`).
- Con `orders:quote` + `printers:read` (para listar impresoras), el operador elige la impresora del pedido. ✅
- ⚠️ **Hallazgo:** el mismo `quote_vars` también acepta del cliente `kwh_cost`, `machine_power_watts`, `machine_cost_per_hour` y `profit_margin_pct` / `profit_multiplier`. Además, `quote/confirm` recibe `informed_price`. O sea, **quien tiene `orders:quote` fija el margen y el precio final de ese pedido**, aunque no pueda tocar la configuración global. Ver pregunta E3-6.

### Implementación
- `backend/app/rbac/constants.py`: contiene `Perm` (`StrEnum`, 22 miembros, propiedades `.resource` y `.action`), `PERM_DESCRIPTIONS`, `RESOURCE_LABELS`, los nombres y descripciones del rol y del grupo, y `OPERATOR_ROLE_PERMS`.
- `backend/app/rbac/services.py`:
  - `sync_permission_catalog()` y `bootstrap_operator_group()` hacen solo `flush`.
  - `seed_rbac(dry_run=False)` envuelve ambas en una transacción: `commit`, o `rollback` si es dry-run o hay un error.
  - Los reportes son dataclasses: `SeedReport`, `CatalogSyncReport` (con `OrphanPermission`) y `OperatorBootstrapReport`.
- `backend/seeds/seed_rbac.py`: wrapper con `--dry-run` y `--strict` (exit 1 si hay huérfanos).
- `backend/seeds/seed_operator.py`: el usuario id=1 queda con `is_superuser=True`, tanto al crearlo como al actualizarlo.
- Tests (`backend/tests/rbac/`):
  - `test_rbac_catalog.py` (9): lógica pura.
  - `test_rbac_seed.py` (10): contra `delivery3d_test`.
- **Diferido a etapa 4:** el test de sincronía con `perms.js`. Hoy el frontend tiene 3 miembros; agregarlo ahora deja la suite en rojo hasta que el frontend se actualice.
- **Dry-run contra desarrollo:**
  - Crearía 22 permisos, el rol "Operador" y el grupo "Operadores".
  - No hay huérfanos.
  - El grupo arranca sin miembros: la base solo tiene `operador` (admin/superuser).
  - Verificado después del dry-run: `permissions=0`, `roles=0`, `groups=0`.

### Preguntas de la etapa 3 (abiertas)
- **E3-6:** con `orders:quote` el operador fija margen, costos de energía y máquina, y precio informado **por pedido**. ¿Es aceptable, porque presupuestar es su tarea? ¿O hay que forzar que esos valores salgan de `workshop_settings` cuando el actor no tiene `settings:update`? Esto último sería lógica en `calculate_quote`; se trataría en la etapa 5.

## Etapa 4 — tests en rojo (HECHO; en verde tras etapa 5)

E3-6: el usuario eligió la **opción B**. Sus tests se escriben en esta etapa; la implementación va en la etapa 5.

### Contratos que fijan los tests (la etapa 5 los implementa sin tocar los tests)

**`app.rbac.services.get_effective_permissions(user_id) -> frozenset[str]`**
- Une los permisos de los roles que el usuario recibe por grupo y por asignación directa.
- Ignora `is_superuser`.

**`app.rbac.security.permission_required(*perms)`**
- Envuelve `login_required`, así que un usuario inactivo recibe 401 aunque sea superusuario.
- Exige todos los permisos (AND). Al superusuario lo deja pasar.
- Si falta alguno → `403 {"error": "Acceso denegado: permisos insuficientes", "code": "FORBIDDEN"}`.

**`app.rbac.security.get_user_permissions() -> frozenset[str]`**
- Devuelve los permisos del usuario actual.
- Los cachea en `flask.g`: dentro de un request devuelve el mismo objeto; en el request siguiente se recalcula.
- Para un superusuario devuelve el catálogo completo.

**`GET /api/auth/me/permissions`** — según `api-contract.md` §1.

**Opción B en `POST /api/orders/<id>/quote`** — se aplica si el actor no tiene `settings:update` y no es superusuario. Regla del usuario: "usa siempre los COSTOS y el margen del taller".

Del body se ignoran estos campos y se reemplazan así:

| Campo | Valor que se usa |
|---|---|
| `kwh_cost` | `workshop_settings.kwh_cost` |
| `profit_margin_pct`, `profit_multiplier` | margen = `(profit_multiplier - 1) * 100` de `workshop_settings` |
| `waste_purge_pct` | `workshop_settings.waste_purge_pct` |
| `labor_cost_per_hour` | `workshop_settings.labor_cost_per_hour` |
| `labor_cost` (monto fijo) | se ignora; siempre se calcula como `tarifa por hora × labor_time_minutes / 60` |
| `machine_power_watts`, `machine_cost_per_hour` | los de la impresora elegida (`printer_id`); si no eligió, los de `default_printer_id` |

Lo que sí se acepta del body:
- `printer_id`. Si no lo manda, se guarda la impresora por defecto. Si no hay impresora elegida ni por defecto → 422 con `errors.printer_id`.
- `labor_time_minutes`, porque es el esfuerzo de cada pedido y no un costo del taller. Si no lo manda, se usa `workshop_settings.default_labor_time_minutes`.
- `informed_price` en `quote/confirm`.

Con `settings:update`, el body se respeta completo.

### Archivos
| Archivo | Tests | Qué cubre |
|---|---|---|
| `backend/tests/rbac/conftest.py` | — | `RbacFactory` (usuarios, roles, grupos y asignaciones de prueba; nunca usa el id=1). `guarded_app`: una app aparte con un blueprint `/_test/rbac/*` protegido, para no proteger todavía las rutas reales. |
| `test_rbac_effective_permissions.py` | 8 | Resolución de permisos. |
| `test_rbac_permission_required.py` | 14 | El decorador y el cache. |
| `test_rbac_me_permissions.py` | 5 | `GET /api/auth/me/permissions`. |
| `test_rbac_quote_pricing_lock.py` | 10 | Opción B. |
| `test_rbac_perms_frontend_sync.py` | 2 | Sincronía con `perms.js`. |

## Etapa 5 — implementación (HECHO)

### Código
- **`backend/app/rbac/services.py`:** se agregó `get_effective_permissions(user_id)`. Resuelve los permisos con una sola consulta `UNION`: grupo → roles → permisos, más roles directos → permisos.
- **`backend/app/rbac/security.py`** (nuevo):
  - `get_user_permissions()` cachea el resultado en `g`. El cache está atado al request actual y al `user_id`, así que nunca se reusa en otro request aunque se comparta el app context. Para un superusuario devuelve `ALL_PERMISSION_CODES`.
  - `has_permission(perm)`.
  - `permission_required(*perms)`:
    - Envuelve `login_required` y exige todos los permisos (AND).
    - Si falta alguno → 403 `{"error", "code": "FORBIDDEN"}`.
    - Falla al importar el módulo si recibe un string o ningún permiso: solo acepta miembros de `Perm`.
- **`backend/app/auth/routes.py`:** nuevo `GET /api/auth/me/permissions`, que solo exige `login_required`.
- **`backend/app/auth/security.py`:**
  - `roles_required` queda marcado DEPRECADO y sin usos.
  - El JWT ya no incluye `username` ni `role`, solo `sub`, `iss`, `iat` y `exp`. `login_required` nunca los leía, y el login y `/me` siguen devolviendo `role` en el cuerpo.
- **Blueprints** `orders`, `cashbox`, `printers`, `settings`, `materials` y `filaments`: los 30 endpoints pasan de `@login_required` a `@permission_required(Perm.X)` según `api-contract.md`. Los 2 de `auth` no cambian: `/login` sigue público y `/me` solo exige sesión.
- **Opción B:**
  - `backend/app/orders/services.py`: nuevo `workshop_quote_vars(requested)` y parámetro `calculate_quote(..., use_workshop_costs)`.
  - `backend/app/orders/routes.py` pasa `use_workshop_costs = not has_permission(Perm.SETTINGS_UPDATE)`.
  - Un `printer_id` que no es entero o que no existe → 422 con `errors.printer_id`.
- **`backend/app/settings/services.py`** (nuevo): `get_or_create_settings()` se movió desde `settings/routes.py`, que ahora lo importa. Así `orders` no depende de un `routes.py`. El comportamiento no cambia.
- **`backend/tests/rbac/test_rbac_workshop_routes.py`** (nuevo, 105 casos):
  - Por cada uno de los 30 endpoints: sin permiso → 403 FORBIDDEN, con exactamente su permiso → ni 401 ni 403, y sin token → 401.
  - Además verifica que la lista de endpoints cubre los 20 permisos de negocio, qué puede y qué no puede hacer el rol "Operador" sembrado, y que `/api/auth/me` y `/me/permissions` solo exigen sesión.

## Etapa 6 — endpoints de administración (HECHO)

### Código
- **`backend/app/rbac/routes.py`** (nuevo): blueprint `rbac_bp` (`/api/rbac`), registrado en `create_app` (y listado en `GET /`). 33 endpoints: lecturas con `permission_required(Perm.RBAC_READ)`, escrituras con `permission_required(Perm.RBAC_MANAGE)`. Sin ORM: cada route hace `ensure` del recurso del path (404) → valida el body con `schemas.py` (422) → llama al service. `errorhandler` del blueprint traduce las excepciones de dominio a `{"error", "code"}` (y `InvalidJsonBody` a 422 `VALIDATION_ERROR` solo dentro de `/api/rbac`; el handler global no cambia).
- **`backend/app/rbac/schemas.py`** (nuevo): validación a mano (`validate_name_description`, `validate_user_ref`/`group_ref`/`role_ref`, `validate_direct_role`, `validate_permission_codes`, `validate_query`) y serializadores (`group_detail`, `role_detail`, `user_detail`, `direct_role_out`, …).
- **`backend/app/rbac/services.py`** (sección "Etapa 6"): excepciones de dominio (`RbacNotFoundError`, `NameTakenError`, `AlreadyMemberError`, `AlreadyAssignedError`, `RoleInUseError`, `SelfAssignmentError`, `SelfLockoutError`, `UnknownPermissionError`), CRUD, membresías, roles directos, acceso efectivo, catálogo e impacto. Commit/rollback solo acá; `IntegrityError` por carrera en un UNIQUE → el mismo conflicto 409.

### Decisiones
- **Un solo cálculo para impacto y `SELF_LOCKOUT`.** `AccessChange` describe el cambio (usuarios afectados, qué *grants* —rol por grupo o directo— se pierden y qué roles cambian de permisos) y `_lost_permissions` lo simula en memoria (≤ 3 consultas, sin escribir). Los endpoints de impacto devuelven el resultado; las mutaciones llaman a `_ensure_no_self_lockout` con el **mismo** `AccessChange` antes de escribir. Así `removes_own_rbac_manage = true` ⇔ la mutación da 409 `SELF_LOCKOUT`, y un 409 nunca deja cambios (no hace falta rollback). Descartado: aplicar el cambio, `flush`, recalcular y `rollback` (más simple de razonar pero con escrituras en un GET y sin orden garantizado respecto de los conflictos).
- **`SELF_ASSIGNMENT`** se evalúa también antes de escribir y antes de los conflictos. En `PUT /roles/{id}/permissions`: el actor tiene el rol (directo o por grupo) y el set nuevo agrega algún code. Quitar está permitido (sujeto a `SELF_LOCKOUT`). Superusuario exento de ambas reglas.
- **`DELETE /roles/{id}`** no evalúa `SELF_LOCKOUT`: un rol sin asignaciones no le quita nada a nadie, y uno con asignaciones da `ROLE_IN_USE`.
- **Validación del catálogo:** un code es válido si está en `Perm` y en la tabla `permissions` (si el seed no corrió, se rechaza con `UNKNOWN_PERMISSION` en vez de fallar con 500).
- **`PUT` de grupos/roles = reemplazo completo** (sin `description` → `null`).
- **Orden de 404:** primero los ids del path (antes de validar el body, como pide el contrato), después los ids del body (después de validarlo).
- **Auditoría:** `created_by`/`updated_by`/`assigned_by` = `g.current_user`; `PUT /roles/{id}/permissions` además actualiza `roles.updated_by`/`updated_at`. Cada mutación se loguea en `delivery3d.audit` (`rbac_group_created`, `rbac_member_added`, `rbac_role_permissions_set added=… removed=…`, etc.).
- **Sin migración:** las tablas y constraints de la etapa 2 alcanzan.

### Contrato
`api-contract.md` queda **cerrado**. §6 (impacto) se fijó con el shape que había propuesto el frontend, sin cambios de claves; §6.bis documenta los detalles que el contrato dejaba abiertos (orden fino de chequeos, validaciones, ordenamientos, `PUT` como reemplazo). No se cambió nada que el frontend ya consumiera. A pedido del frontend, dos ajustes aditivos/de texto: `affected_users[].lost_permissions_detail` (`{code, description}`, paralelo a `lost_permissions`) y una aclaración en §2: `/access` no lista grupos sin roles; la membresía se lee de `GroupDetail.members` o `GET /users/{id}/groups`.

### Tests (`backend/tests/rbac/`)
| Archivo | Qué cubre |
|---|---|
| `admin_support.py` | Helpers: `setup_admin` (admin **no** superusuario con `rbac:read` + `rbac:manage` vía grupo "Seguridad"), `reader`, `count`/`fetch`, `assert_error`. |
| `test_rbac_admin_authz.py` | Los 33 endpoints: sin token 401, sin permisos 403 `FORBIDDEN` (antes que 404/422); lecturas con solo `rbac:read`; escrituras exigen `rbac:manage`. |
| `test_rbac_admin_groups.py` | CRUD de grupos, miembros y roles del grupo; auditoría; `NAME_TAKEN` sin mayúsculas; cascada; `SELF_ASSIGNMENT` (incluido antes de `ALREADY_MEMBER`), `SELF_LOCKOUT`, superusuario exento. |
| `test_rbac_admin_roles.py` | CRUD de roles, `ROLE_IN_USE`, `PUT …/permissions` (reemplazo, duplicados, `[]`, `UNKNOWN_PERMISSION`, `SELF_ASSIGNMENT` por grupo y directo, `SELF_LOCKOUT`). |
| `test_rbac_admin_users.py` | Listado con conteos y `q` (escapa `%`/`_`), detalle sin hash, grupos del usuario, roles directos (`reason`, `assigned_by` del actor), `/access` (orígenes, superusuario, propio usuario con solo `rbac:read`), `is_superuser` inmodificable. |
| `test_rbac_admin_catalog.py` | `GET /permissions` agrupado en el orden de `RESOURCE_LABELS`, roles por permiso, sin métodos de escritura. |
| `test_rbac_admin_impact.py` | Los 6 endpoints de impacto: pérdidas contemplando otras vías, superusuario sin pérdidas, `removes_own_rbac_manage` coherente con `SELF_LOCKOUT`, sin efectos, 404 de asignación inexistente, solo `rbac:read`. |

## Involved Files (real paths)
Relevados para esta etapa (no se modifican en la etapa 1):
- `backend/app/auth/models.py` — `User` (`id`, `username`, `password_hash`, `role VARCHAR(20)`, `is_active`, `created_at`; **sin** `is_superuser` ni `updated_at`).
- `backend/app/auth/security.py` — `generate_jwt_token` (claims `sub`, `username`, `role`, `iss`, `iat`, `exp`), `login_required` (setea `g.current_user_id`, `g.current_user`), `roles_required(*roles)` (**sin uso en ninguna ruta**).
- `backend/app/__init__.py` — factory, orden de import de modelos, registro de blueprints.
- Blueprints: `backend/app/{orders,cashbox,printers,settings,materials,filaments,auth}/routes.py` (todos con `@login_required` únicamente).
- `backend/migrations/versions/` — cabeza actual `8b56eb6b8347 → 411d9c4af9cc → c8c9b0e3a953` (`add_role_and_is_active_to_users`, última).
- `backend/tests/conftest.py` — `db.create_all()` (los tests **no** usan migraciones), `_clean_tables` con `TRUNCATE TABLE {table}` sin comillas, usuario fixture `User(id=1, role="admin")`, `make_token`, `auth_headers`.
- `backend/seeds/seed_operator.py` — crea/actualiza el usuario id=1 con `role="admin"`.
- `openspec/archive/2026-09-18-order-deletion/spec-delta.md` — "cualquier operador autenticado" puede borrar pedidos en cualquier estado.

Previstos para etapas siguientes (paths a confirmar en cada etapa):
- `backend/app/rbac/{__init__,models,constants,services,security,schemas,routes}.py`
- `backend/migrations/versions/<rev>_add_rbac_tables.py`
- `backend/seeds/seed_permissions.py`
- `backend/tests/rbac/`
- `openspec/changes/rbac-access-control/spec-delta.md`

---

## Etapa 1 — Modelo de datos

### Convenciones aplicadas (tomadas del código existente)
- PK `INT AUTO_INCREMENT` llamada `id` en **todas** las tablas, incluidas las puente (igual que `order_items`, `cash_movements`; no hay PK compuestas en el repo). La unicidad del par se garantiza con `UNIQUE`.
- Tablas en plural, snake_case; constraints con nombre explícito (`uq_<tabla>_<cols>`, `ix_<tabla>_<col>`, `chk_<tabla>_<regla>`, `fk_<tabla>_<col>`), como `chk_printers_power_watts` / `ix_printers_is_active`.
- Fechas `DATETIME` en UTC con default `_utcnow` en Python y `onupdate` para `updated_at` (patrón de `printers` y `workshop_settings`).
- Charset `utf8mb4_unicode_ci`, InnoDB.
- FKs hacia `users` en el repo no declaran `ondelete` (= `RESTRICT`/`NO ACTION`): `orders.user_id`, `order_status_history.changed_by`, `cash_movements.user_id`. Los usuarios no se borran físicamente; se desactivan con `is_active = 0`.

### Diagrama

```mermaid
erDiagram
    users {
        INT id PK "AUTO_INCREMENT"
        VARCHAR(80) username UK "uq users.username (existente)"
        VARCHAR(255) password_hash "NOT NULL (existente)"
        VARCHAR(20) role "existente - DEPRECADA, no se usa para autorizar"
        TINYINT(1) is_active "NOT NULL DEFAULT 1 (existente)"
        TINYINT(1) is_superuser "NUEVA - NOT NULL DEFAULT 0"
        DATETIME created_at "NOT NULL (existente)"
        DATETIME updated_at "NUEVA (a confirmar) - NOT NULL, backfill = created_at"
    }

    groups {
        INT id PK "AUTO_INCREMENT"
        VARCHAR(100) name UK "uq_groups_name - NOT NULL"
        VARCHAR(255) description "NULL"
        DATETIME created_at "NOT NULL"
        DATETIME updated_at "NOT NULL, onupdate"
        INT created_by FK "NULL = sistema - ix_groups_created_by - ON DELETE RESTRICT"
        INT updated_by FK "NULL = sistema - ix_groups_updated_by - ON DELETE RESTRICT"
    }

    roles {
        INT id PK "AUTO_INCREMENT"
        VARCHAR(100) name UK "uq_roles_name - NOT NULL"
        VARCHAR(255) description "NULL"
        DATETIME created_at "NOT NULL"
        DATETIME updated_at "NOT NULL, onupdate"
        INT created_by FK "NULL = sistema - ix_roles_created_by - ON DELETE RESTRICT"
        INT updated_by FK "NULL = sistema - ix_roles_updated_by - ON DELETE RESTRICT"
    }

    permissions {
        INT id PK "AUTO_INCREMENT"
        VARCHAR(100) code UK "uq_permissions_code - inmutable - recurso:accion"
        VARCHAR(50) resource "NOT NULL - uq_permissions_resource_action (resource, action)"
        VARCHAR(50) action "NOT NULL"
        VARCHAR(255) description "NOT NULL"
        DATETIME created_at "NOT NULL"
    }

    user_groups {
        INT id PK "AUTO_INCREMENT"
        INT user_id FK "NOT NULL - uq_user_groups_user_id_group_id (user_id, group_id) - ON DELETE CASCADE"
        INT group_id FK "NOT NULL - ix_user_groups_group_id - ON DELETE CASCADE"
        DATETIME created_at "NOT NULL"
        DATETIME updated_at "NOT NULL, onupdate"
        INT created_by FK "NULL = sistema - ix_user_groups_created_by - ON DELETE RESTRICT"
        INT updated_by FK "NULL = sistema - ix_user_groups_updated_by - ON DELETE RESTRICT"
    }

    group_roles {
        INT id PK "AUTO_INCREMENT"
        INT group_id FK "NOT NULL - uq_group_roles_group_id_role_id (group_id, role_id) - ON DELETE CASCADE"
        INT role_id FK "NOT NULL - ix_group_roles_role_id - ON DELETE RESTRICT"
        DATETIME created_at "NOT NULL"
        DATETIME updated_at "NOT NULL, onupdate"
        INT created_by FK "NULL = sistema - ix_group_roles_created_by - ON DELETE RESTRICT"
        INT updated_by FK "NULL = sistema - ix_group_roles_updated_by - ON DELETE RESTRICT"
    }

    user_roles {
        INT id PK "AUTO_INCREMENT"
        INT user_id FK "NOT NULL - uq_user_roles_user_id_role_id (user_id, role_id) - ON DELETE CASCADE"
        INT role_id FK "NOT NULL - ix_user_roles_role_id - ON DELETE RESTRICT"
        VARCHAR(255) reason "NOT NULL - chk_user_roles_reason_not_blank"
        DATETIME assigned_at "NOT NULL (hace de created_at)"
        INT assigned_by FK "NULL = sistema - ix_user_roles_assigned_by - ON DELETE RESTRICT (hace de created_by)"
        DATETIME updated_at "NOT NULL, onupdate"
        INT updated_by FK "NULL = sistema - ix_user_roles_updated_by - ON DELETE RESTRICT"
    }

    role_permissions {
        INT id PK "AUTO_INCREMENT"
        INT role_id FK "NOT NULL - uq_role_permissions_role_id_permission_id (role_id, permission_id) - ON DELETE CASCADE"
        INT permission_id FK "NOT NULL - ix_role_permissions_permission_id - ON DELETE RESTRICT"
        DATETIME created_at "NOT NULL"
        DATETIME updated_at "NOT NULL, onupdate"
        INT created_by FK "NULL = sistema - ix_role_permissions_created_by - ON DELETE RESTRICT"
        INT updated_by FK "NULL = sistema - ix_role_permissions_updated_by - ON DELETE RESTRICT"
    }

    users ||--o{ user_groups : "pertenece a"
    groups ||--o{ user_groups : "tiene miembros"
    groups ||--o{ group_roles : "otorga"
    roles ||--o{ group_roles : "es otorgado por"
    users ||--o{ user_roles : "excepcion directa"
    roles ||--o{ user_roles : "asignado directo"
    roles ||--o{ role_permissions : "contiene"
    permissions ||--o{ role_permissions : "incluido en"
    users |o--o{ groups : "created_by / updated_by"
    users |o--o{ roles : "created_by / updated_by"
    users |o--o{ user_roles : "assigned_by / updated_by"
```

> Las relaciones de auditoría (`created_by`/`updated_by`/`assigned_by`) también existen en `user_groups`, `group_roles` y `role_permissions`; se omiten del dibujo para no saturarlo, están listadas como columnas FK.

### Detalle de índices y constraints

| Tabla | PK | UNIQUE | Índices (FK) | CHECK |
|---|---|---|---|---|
| `users` | `id` | `username` (existente) | — | — |
| `groups` | `id` | `uq_groups_name (name)` | `ix_groups_created_by`, `ix_groups_updated_by` | — |
| `roles` | `id` | `uq_roles_name (name)` | `ix_roles_created_by`, `ix_roles_updated_by` | — |
| `permissions` | `id` | `uq_permissions_code (code)`, `uq_permissions_resource_action (resource, action)` | — | `chk_permissions_code_matches = (code = CONCAT(resource, ':', action))` |
| `user_groups` | `id` | `uq_user_groups_user_id_group_id (user_id, group_id)` | `ix_user_groups_group_id`, `ix_user_groups_created_by`, `ix_user_groups_updated_by` | — |
| `group_roles` | `id` | `uq_group_roles_group_id_role_id (group_id, role_id)` | `ix_group_roles_role_id`, `ix_group_roles_created_by`, `ix_group_roles_updated_by` | — |
| `user_roles` | `id` | `uq_user_roles_user_id_role_id (user_id, role_id)` | `ix_user_roles_role_id`, `ix_user_roles_assigned_by`, `ix_user_roles_updated_by` | `chk_user_roles_reason_not_blank = (CHAR_LENGTH(TRIM(reason)) > 0)` |
| `role_permissions` | `id` | `uq_role_permissions_role_id_permission_id (role_id, permission_id)` | `ix_role_permissions_permission_id`, `ix_role_permissions_created_by`, `ix_role_permissions_updated_by` | — |

- **Índice de la primera FK de cada puente:** lo cubre el `UNIQUE` compuesto (InnoDB usa el prefijo izquierdo como índice de la FK). Se declara índice explícito solo para la segunda columna y las de auditoría. Si se prefiere un índice explícito también para la primera columna (redundante), avisar.
- **Consulta de resolución** (etapa 5) recorre: `user_groups(user_id)` → `group_roles(group_id)` → `role_permissions(role_id)` y `user_roles(user_id)` → `role_permissions(role_id)`. Todos los accesos usan el prefijo izquierdo de un `UNIQUE`; no hace falta ningún índice adicional.
- **Sin CHECK `assigned_by <> user_id` en la base:** MySQL 8 prohíbe usar en un `CHECK` una columna que participa de una FK con acción referencial (`user_id` es `ON DELETE CASCADE`, error 3823). La regla "nadie se asigna roles a sí mismo" se valida en `services.py` (etapa 6) y se cubre con tests.

### ON DELETE — justificación por FK

| FK | Acción | Por qué |
|---|---|---|
| `user_groups.user_id → users.id` | `CASCADE` | La membresía no tiene sentido sin el usuario. En la práctica los usuarios no se borran (se desactivan), así que es una red de seguridad, no un flujo. |
| `user_groups.group_id → groups.id` | `CASCADE` | Borrar un grupo = disolverlo. Quitar acceso es fail-safe (nadie gana permisos). El endpoint de borrado (etapa 6) lo loguea en el audit logger. |
| `group_roles.group_id → groups.id` | `CASCADE` | Mismo motivo: los roles otorgados por un grupo son parte del grupo. |
| `group_roles.role_id → roles.id` | `RESTRICT` | Borrar un rol en uso por grupos impacta a muchos usuarios de golpe. Se obliga a desasignarlo explícitamente; el endpoint devuelve 409 "rol en uso". |
| `user_roles.user_id → users.id` | `CASCADE` | Igual que `user_groups.user_id`. |
| `user_roles.role_id → roles.id` | `RESTRICT` | Igual que `group_roles.role_id`; además la asignación directa tiene un `reason` que se perdería en silencio. |
| `role_permissions.role_id → roles.id` | `CASCADE` | Los permisos son parte de la definición del rol: si el rol se borra (ya sin asignaciones, por los RESTRICT anteriores), su lista de permisos se va con él. |
| `role_permissions.permission_id → permissions.id` | `RESTRICT` | Los permisos solo cambian por código. Quitar un permiso del catálogo en uso debe ser una migración consciente que primero borre sus asignaciones. |
| `*.created_by`, `*.updated_by`, `user_roles.assigned_by → users.id` | `RESTRICT`, columna `NULL` | Consistente con `orders.user_id` / `cash_movements.user_id` / `order_status_history.changed_by` (sin `ondelete` = RESTRICT). Mantiene la auditoría: no se puede borrar físicamente a quien firmó un cambio. `NULL` se reserva para filas creadas por migración o seed ("sistema"). `SET NULL` se descarta porque borra la autoría; `CASCADE` se descarta porque borraría permisos de terceros. |

### Columnas nuevas en `users`
| Columna | Tipo | Default / backfill | Motivo |
|---|---|---|---|
| `is_superuser` | `TINYINT(1) NOT NULL` | `server_default '0'`; backfill según la pregunta P1 | Pedido por el modelo: bypass total sin comodines. |
| `updated_at` | `DATETIME NOT NULL` | backfill `= created_at`, luego `onupdate` | Pedido de consistencia (P2): marcar cambios sensibles como `is_superuser`/`is_active`. |

### Cómo se traduce "Depends cacheado" a Flask
FastAPI cachea una dependencia por request; en Flask el equivalente es `flask.g`, que vive una sola app context = un request (también en `app.test_client()`):

```text
login_required            (existente: valida JWT, carga g.current_user)
  └─ permission_required(*perms)   (nuevo decorador, envuelve a login_required igual que roles_required hoy)
        ├─ if g.current_user.is_superuser → pasa
        ├─ get_user_permissions() → frozenset[str]
        │     ├─ si existe g._rbac_permissions → lo devuelve (cache del request)
        │     └─ si no: 1 consulta (UNION camino grupo + camino directo) → guarda en g
        └─ si falta algún perm → 403 {"error": "Acceso denegado: permisos insuficientes"} (mismo mensaje que roles_required)
```
- Una sola consulta SQL por request, sin importar cuántos decoradores o llamadas a `get_user_permissions()` haya.
- Sin cache entre requests: quitar un rol impacta en el próximo request sin invalidar el JWT.
- Semántica de varios permisos en el decorador: ver P6.

---

## Conflictos con el código existente

1. **`users.role` + `roles_required`.** El modelo nuevo reemplaza ambos, pero:
   - `test_auth.py:20` afirma `data["user"]["role"] == "admin"` en la respuesta de login, y la spec viva `openspec/specs/auth/spec.md` (REQ-AUTH-03) fija `/me` = `{id, username, role, is_active, created_at}`.
   - El frontend muestra `user.role` en `AppTopbar.js:45` y `AppInlineProfile.js:25` (`user.role.toUpperCase()` rompe si `role` desaparece).
   - Quitar la columna o la clave del JSON obliga a cambiar un test y el contrato → requiere tu OK (regla: no se modifican tests para que pasen).
   - **Propuesta:** en etapa 2 la columna se **conserva deprecada** (no se usa para autorizar), `to_dict()` sigue devolviendo `role` y se agrega `is_superuser`. `roles_required` se elimina en etapa 5 (no tiene usos). El drop físico de `role` queda para un cambio posterior coordinado con el frontend.
2. **Hoy "operator" tiene acceso total de hecho.** Como `roles_required` no se usa, un `operator` puede hacer todo lo que hace un `admin`. Mapear `operator → sin roles` le quitaría todo acceso en el deploy. Ver P1.
3. **Fixture de tests.** `conftest.py` crea `User(id=1, role="admin")` y todos los tests usan su token. Cuando las rutas exijan permisos, ese usuario necesita `is_superuser=True` (o roles), y `_clean_tables` debe truncar las 6 tablas nuevas. Esto es modificar `conftest.py` (no un test), pero lo marco para que lo apruebes explícitamente.
4. **`groups` es palabra reservada en MySQL 8** (funciones de ventana). SQLAlchemy 2.0.53 la cita sola (está en su lista de reservadas), pero el SQL crudo no: `conftest.py` hace `TRUNCATE TABLE {table}` sin backticks → `TRUNCATE TABLE groups` falla con error de sintaxis. Opciones: (a) mantener `groups` y usar backticks en todo SQL crudo (incluido conftest); (b) renombrar la tabla (ej. `user_groups_catalog`, feo; o `teams`). Recomiendo (a). Ver P5.
5. **Tests usan `db.create_all()`, no migraciones.** Índices, CHECKs y `ondelete` deben declararse idénticos en el modelo SQLAlchemy y en la migración; si no, la base de test diverge de producción. Se verificará en etapa 2 comparando `SHOW CREATE TABLE` de ambas.
6. **JWT con `username` y `role`.** `generate_jwt_token` incluye ambos claims; el modelo decidido pide solo `user_id`. `login_required` ya ignora esos claims (lee la base), así que quitarlos no rompe nada del backend; `test_auth.py:81` solo los usa para armar un token expirado (no los afirma). Se quitan en etapa 5.
7. **Spec de borrado de pedidos.** `openspec/archive/2026-09-18-order-deletion/spec-delta.md` dice "operadores autenticados" pueden borrar en cualquier estado. Con RBAC pasa a requerir `orders:delete`. Los tests de `test_orders_delete.py` siguen pasando con el usuario fixture superuser; se agregan tests de 403. El "cualquier estado" no cambia. Se escribirá `spec-delta.md` con el requisito **MODIFIED**, y en el frontend el botón de borrar se muestra solo con el permiso.
8. **`user_roles` duplica auditoría.** El pedido exige en todas las puentes `created_at/updated_at/created_by/updated_by` y además en `user_roles` `assigned_by/assigned_at`. Son lo mismo; tenerlos dos veces viola 3FN. Propuesta en el diagrama: en `user_roles`, `assigned_at`/`assigned_by` **reemplazan** a `created_at`/`created_by`, y se mantienen `updated_at`/`updated_by` (para cambios de `reason`). Ver P3.
9. **No hay ABM de usuarios.** Los usuarios solo se crean por `seeds/seed_operator.py`. Las asignaciones de grupos/roles (etapa 6) funcionan sobre usuarios existentes; cambiar `is_superuser` por API no está en el pedido (ver P7).

---

## Preguntas para el usuario (bloquean la etapa 2)

- **P1 — Migración de datos de `users.role`.** Hoy todos operan con acceso total.
  - (a) `admin → is_superuser = 1`; `operator → is_superuser = 0` y además se crea en el seed (etapa 3) un grupo **"Operadores"** con un rol **"Operador"** con todos los permisos de negocio excepto `rbac:manage` (preserva el acceso actual salvo administración). *Recomendada.*
  - (b) `admin → rol "Administrador"` (todos los permisos) vía grupo "Administradores", sin superusuarios salvo el seed id=1.
  - (c) Todos sin acceso hasta que un superusuario asigne roles (más seguro, rompe la operación al desplegar).
  - ¿El rol "Operador" debería incluir `orders:delete` y los permisos de caja/configuración, o restringirse ya?
- **P2 — `users.updated_at`.** ¿Lo agregamos (backfill = `created_at`)? Recomiendo sí.
- **P3 — Auditoría en `user_roles`.** ¿Aceptás que `assigned_at/assigned_by` reemplacen a `created_at/created_by` (manteniendo `updated_at/updated_by`)? ¿O querés las 6 columnas?
- **P4 — ON DELETE.** ¿Aprobás la tabla de arriba? En particular: borrar un **grupo** en CASCADE (se disuelve) y borrar un **rol** en RESTRICT (409 si está en uso). Alternativa: ambos RESTRICT.
- **P5 — Tabla `groups`.** ¿Mantenemos el nombre (con backticks en SQL crudo, incluido `conftest.py`) o lo renombramos?
- **P6 — `permission_required(A, B)`.** ¿Exige **todos** (AND) o **alguno** (OR)? Recomiendo AND (más seguro; si hace falta OR, se agrega `any_permission_required` explícito).
- **P7 — `is_superuser` por API.** ¿Se podrá cambiar desde los endpoints de administración (etapa 6) o solo por seed/CLI? Recomiendo solo seed/CLI (evita escalada vía `rbac:manage`).
- **P8 — `conftest.py`.** ¿Autorizás modificar el fixture (`is_superuser=True` en el usuario id=1, truncar tablas nuevas con backticks)? No se toca ningún test existente.
- **P9 — `users.role`.** ¿Ok conservarla deprecada (y en la respuesta de `/me` y login) en este cambio y droppearla en un cambio posterior con el frontend? ¿O la droppeamos ahora aceptando cambiar `test_auth.py:20` y la spec REQ-AUTH-03?
- **P10 — Usuario inactivo / superuser inactivo.** Se asume que `is_active = 0` sigue cortando antes (401 en `login_required`) y que `is_superuser` no lo saltea. Confirmar.

---

## Constants / Enums / Magic IDs
**Reemplazado** por "Etapa 3 — propuesta de catálogo" (arriba). Se conserva el borrador original de la etapa 1 como historial:

| Recurso (prefijo) | Acciones candidatas | Endpoints |
|---|---|---|
| `orders` | `read`, `create`, `update`, `delete`, `quote`, `approve`, `deliver` | `/api/orders/...` (`quote`, `quote/confirm`, `approve`, `start-printing`, `mark-ready`, `deliver`, `history`) |
| `cash_movements` | `read`, `create` | `/api/cashbox/movements`, `/summary`, `/orders/<id>/balance`, `/orders/<id>/collect-balance` |
| `cash_categories` | `read`, `create`, `update` | `/api/cashbox/categories/{income,expense}` |
| `printers` | `read`, `create`, `update` | `/api/printers` |
| `settings` | `read`, `update` | `/api/settings` |
| `materials` | `read` | `/api/materials` |
| `filaments` | `read` | `/api/filaments` |
| `rbac` | `manage` | `/api/rbac/...` (etapa 6) |

## Security & Permissions
- Fail-closed: sin permiso → 403; sin token/usuario inactivo → 401 (sin cambios).
- `is_superuser` no se puede asignar por la API de RBAC (pendiente P7).
- Nadie modifica sus propias membresías/asignaciones (validación en service, etapa 6).
- Altas/bajas de asignaciones se registran en el audit logger (`delivery3d.audit`) con `user_id` del actor.

## ⚠️ High-Risk Files / Modules
- `backend/app/auth/security.py` — afecta a todas las rutas.
- Todos los `routes.py` en etapa 5 (cambio masivo de decoradores): un permiso mal puesto bloquea la operación del taller o abre un endpoint.
- `backend/tests/conftest.py` — base de toda la suite.

## Impact on Data / Integraciones
- Migración aditiva (6 tablas nuevas + 1-2 columnas en `users`) + backfill de `is_superuser` según P1. Sin `drop_column` en este cambio (salvo decisión distinta en P9).
- Sin servicios externos.

## Schema Changes / Migrations
Se completa en la etapa 2.

## Decisions (Short ADR)
- **Decision:** PK surrogate `id INT AUTO_INCREMENT` + `UNIQUE` compuesto en tablas puente. **Discarded:** PK compuesta. **Reason:** convención del repo (todas las tablas tienen `id`); facilita referenciar una asignación concreta en la API de administración (`DELETE /api/rbac/user-roles/<id>`).
- **Decision:** auditoría `created_by/updated_by/assigned_by` NULLables con `ON DELETE RESTRICT`. **Discarded:** `SET NULL`, NOT NULL. **Reason:** conserva autoría, coherente con FKs a `users` existentes; NULL = sistema (migración/seed).
- **Decision:** CHECK `code = CONCAT(resource, ':', action)` en `permissions`. **Discarded:** sin CHECK o columnas generadas. **Reason:** `code` y `(resource, action)` son claves candidatas equivalentes (BCNF OK); el CHECK impide que se desincronicen.
- **Decision:** regla "no auto-asignación" en service, no en DB. **Reason:** MySQL 8 no permite CHECK sobre columnas con acción referencial (error 3823).
- **Decision:** resolución por request cacheada en `flask.g`. **Discarded:** permisos en el JWT; cache de proceso. **Reason:** decisión del usuario; revocación inmediata.

---

## Inventory of Built Artifacts
### Etapa 1
- [x] **Create** `openspec/changes/rbac-access-control/proposal.md`
- [x] **Create** `openspec/changes/rbac-access-control/design.md` (este archivo, sección Etapa 1)

### Etapa 2
- [x] **Modify** `backend/app/auth/models.py` — `is_superuser`, `updated_at`
- [x] **Create** `backend/app/rbac/__init__.py`, `backend/app/rbac/models.py`
- [x] **Modify** `backend/app/__init__.py` — import de modelos RBAC
- [x] **Create** `backend/migrations/versions/44a4db68ccde_add_rbac_tables.py`
- [x] **Modify** `backend/tests/conftest.py` — superuser id=1 + truncado tablas nuevas (P8)
- [x] **Create** `openspec/changes/rbac-access-control/api-contract.md` (borrador)
- [ ] `flask db upgrade` contra la base real — **pendiente de aprobación del usuario**

### Etapas 3-7
Se detallan al aprobarse cada etapa.
