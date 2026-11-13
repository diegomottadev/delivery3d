# Design: order-intake

> **Superseded schema notice:** este change se implementó originalmente sobre un `Order` con `customer_name`/`contact`/`piece_description` inline. A mitad de implementación se adoptó un esquema normalizado (1FN-4FN/BCNF) que introduce `clients`, `materials` y `order_items` como entidades propias. Este documento refleja el esquema **final, implementado y testeado** (no el borrador inicial). Ver `app/backend/migrations/schema_design_normalized.sql` para el DDL completo de referencia y `openspec/project.md` para la justificación de normalización.

## Involved Files (real paths — implementados)
- `app/backend/requirements.txt`, `app/backend/.env.example` — dependencias y config (Flask, Flask-SQLAlchemy, Flask-Migrate, PyMySQL, `cryptography`, PyJWT, pytest, ruff).
- `app/backend/app/extensions.py` — `db = SQLAlchemy()`, `migrate = Migrate()`.
- `app/backend/app/auth/security.py` — `login_required` (placeholder: exige JWT válido, resuelve `g.current_user_id` desde el claim `sub`).
- `app/backend/app/auth/models.py` — `User` (`id`, `username`, `password_hash` sin usar aún, `created_at`).
- `app/backend/app/clients/models.py` — `Client` (`id`, `name`, `origin`, `phone`, `instagram_username`, `notes`, `created_at`).
- `app/backend/app/materials/models.py` — `Material` (`id`, `brand`, `type`, `color`, `cost_per_kg`, `created_at`).
- `app/backend/app/orders/models.py` — `Order` (`id`, `client_id`, `user_id`, `status`, `created_at`), `OrderItem` (`order_id`, `material_id`, `piece_description`, `reference_url`, `weight_g`, `print_time_minutes`, `quantity`), `OrderStatusHistory`.
- `app/backend/app/orders/schemas.py` — validación de `POST /api/orders` (cliente nuevo o `client_id` existente + lista de ítems) y serialización.
- `app/backend/app/orders/services.py` — `create_order(...)`, `list_orders()`, `get_order(order_id)`.
- `app/backend/app/orders/routes.py` — `orders_bp`: `POST /api/orders`, `GET /api/orders`, `GET /api/orders/<order_id>`.
- `app/backend/migrations/versions/a59cc2d56543_..._and_a1b86c4c24db_normalize_schema_...py` — migraciones Alembic aplicadas.
- `app/backend/seeds/seed_operator.py`, `app/backend/seeds/seed_materials.py` — datos semilla.
- `app/backend/tests/orders/test_intake.py` — 20 tests.
- `frontend/` — **diferido**, ver decisión de alcance (backend de los 3 changes primero).

## Technical Approach
Backend Flask organizado en módulos por dominio (`app/auth/`, `app/clients/`, `app/materials/`, `app/orders/`, `app/cashbox/`), cada uno con `models.py` propio. `app/orders/services.py` concentra la lógica de negocio y es la única capa que toca `db.session`; `routes.py` solo parsea request/response y delega.

**Contrato de `POST /api/orders`:**
```json
{
  "client_id": 12,                          // O bien client_id, o bien "client" (no ambos)
  "client": {"name": "...", "origin": "whatsapp|instagram_dm|otro", "phone": "...", "instagram_username": "...", "notes": "..."},
  "items": [
    {"material_id": 3, "piece_description": "...", "reference_url": "...", "weight_g": 120.00, "print_time_minutes": 210, "quantity": 1}
  ]
}
```
Si se envía `client_id`, se reutiliza el cliente existente (404-como-422 si no existe). Si se envía `client`, se crea un `Client` nuevo en la misma transacción. Cada `item` debe referenciar un `material_id` existente (catálogo sembrado por `seed_materials.py`; gestión completa de materiales queda fuera de alcance).

Order, sus `OrderItem` y la primera fila de `OrderStatusHistory` se crean en una única transacción atómica (`create_order`).

## Constants / Enums / Magic IDs
- `OrderStatus` (`app/backend/app/orders/models.py`): `nuevo, presupuestado, aprobado, imprimiendo, listo, entregado, cancelado` (valores en español minúscula, alineados al esquema normalizado). Este change solo alcanza `nuevo`. `cancelado` está declarado pero sin transición implementada (ver `order-lifecycle`).
- `ClientOrigin` (`app/backend/app/clients/models.py`): `whatsapp, instagram_dm, otro`.
- `MaterialType` (`app/backend/app/materials/models.py`): `PLA, PETG, ABS, TPU, otro`.

## Security & Permissions
- Todas las rutas de `orders_bp` requieren `@login_required` (placeholder — ver `openspec/project.md`).
- Tabla `users` mínima (`id`, `username`, `password_hash` sin usar) con operador seed `id=1` (`seed_operator.py`), usado como `created_by`/`changed_by` mientras `auth` no exista.

## ⚠️ High-Risk Files / Modules
- Ninguno directamente en este change. `orders`/`order_items` son la base sobre la que `quote-calculation` y `order-lifecycle` migran — cualquier defecto de esquema aquí tiene alto radio de impacto (confirmado: sí hubo que migrar `orders` dos veces al pasar al esquema normalizado).

## Impact on Data / Integraciones
- Base de datos MySQL 8.0 (contenedor Docker `mysql8`, DB `delivery3d`/`delivery3d_test`, charset `utf8mb4`/`utf8mb4_unicode_ci`, `ENGINE=InnoDB`). Sin integraciones externas.

## Schema Changes / Migrations
Ver DDL completo en `app/backend/migrations/schema_design_normalized.sql`. Resumen de las tablas que este change introduce/usa:
```sql
CREATE TABLE users (id, username UNIQUE, password_hash, created_at) ENGINE=InnoDB CHARSET=utf8mb4;
CREATE TABLE clients (id, name, origin, phone, instagram_username, notes, created_at) ENGINE=InnoDB CHARSET=utf8mb4;
CREATE TABLE materials (id, brand, type, color, cost_per_kg, created_at) ENGINE=InnoDB CHARSET=utf8mb4;
CREATE TABLE orders (id, client_id FK, user_id FK, status, created_at) ENGINE=InnoDB CHARSET=utf8mb4;
CREATE TABLE order_items (id, order_id FK CASCADE, material_id FK RESTRICT, piece_description, reference_url,
    weight_g, print_time_minutes, quantity) ENGINE=InnoDB CHARSET=utf8mb4;
CREATE TABLE order_status_history (id, order_id FK, from_status, to_status, changed_by FK, changed_at) ENGINE=InnoDB CHARSET=utf8mb4;
```
Migraciones Alembic reales aplicadas: `a59cc2d56543` (esquema inicial denormalizado, superseded), `a1b86c4c24db` (normalización: agrega `clients`/`materials`/`order_items`/`order_quotes`/`cash_movements`, quita columnas inline de `orders`).

## Decisions (Short ADR)
- **Decision:** Adoptar esquema normalizado 1FN-4FN/BCNF a mitad de implementación (ver `openspec/project.md`).
  - **Discarded alternative:** Mantener `Order` con campos inline (`customer_name`, `contact`, `piece_description`).
  - **Reason:** Requisito explícito del usuario para evitar anomalías de inserción/actualización/borrado y dependencias multivaluadas (multi-pieza + multi-material por pedido).
- **Decision:** Tabla `users` mínima con operador seed único, mientras no exista `auth`.
  - **Reason:** igual que en la versión anterior de este documento — sin esto, `created_by`/`changed_by NOT NULL` no puede satisfacerse.
- **Decision:** Catálogo de `materials` sembrado con 3 filamentos de arranque (`seed_materials.py`), sin CRUD propio en este change.
  - **Reason:** `order_items.material_id` es `NOT NULL`, así que se necesita al menos un material válido para poder testear/usar el alta; gestión completa del catálogo es un change futuro acotado.

---

## Inventory of Built Artifacts

### Database
- [x] **Create** tables `users`, `clients`, `materials`, `orders`, `order_items`, `order_status_history` (+ `order_quotes`, `cash_movements` creadas también por la migración normalizadora, usadas por los otros 2 changes).

### Backend
- [x] `login_required` (`app/auth/security.py`)
- [x] `OrdersService::create_order(items, created_by, client_id=None, client=None)` — cliente nuevo o existente + N ítems, transacción atómica + primera fila de historial.
- [x] `OrdersService::list_orders()`, `get_order(order_id)`
- [x] `orders_bp`: `POST /api/orders`, `GET /api/orders`, `GET /api/orders/<order_id>`

### Frontend
- [ ] Diferido — ver decisión de alcance.

### Configuration
- [x] `app/backend/requirements.txt`, `app/backend/.env.example`

### Tests
- [x] `test_intake.py` — 20 tests, 100% cobertura de `app/orders` (para este change) y `app/auth`.

**Lo que este change explícitamente NO toca:** cálculo de cotización, transiciones más allá de `nuevo`, movimientos de caja, CRUD de materiales/clientes.
