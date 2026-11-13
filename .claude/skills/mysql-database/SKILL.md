---
name: mysql-database
description: Base de datos MySQL 8 de Delivery3D (Flask-SQLAlchemy + Alembic). Usar siempre que se toque el esquema o los datos — modelos en backend/app/*/models.py, migraciones en backend/migrations/versions/ (flask db migrate/upgrade/downgrade), CHECK/índices/FKs, seeds en backend/seeds/, SQL crudo, consultas a la base de desarrollo o diferencias entre los tests y la base real — aunque el pedido solo diga "agregá un campo", "nueva tabla", "renombrá la columna" o "¿por qué la base acepta esto?".
---

# Base de datos — MySQL 8 (Delivery3D)

Para capas y estilo de código aplicá también **flask-backend-practices**. Este skill cubre lo que los modelos y las migraciones no te dicen.

## La trampa principal: los tests no usan las migraciones

Los tests crean el esquema con `db.create_all()` (`backend/tests/conftest.py`); la base real, con Alembic. Si cambiás un modelo sin migración equivalente, **los tests pasan y la base real queda distinta**. Pasó: 6 CHECK vivieron solo en los modelos hasta `e5c1a7d93f20`.

Por eso, todo cambio de esquema:
1. Toca **modelo y migración juntos**, con los **mismos nombres** de constraints e índices.
2. Se verifica contra una base migrada con las dos herramientas (Alembic no compara CHECK; la segunda sí):
   ```bash
   cd backend && PYTHONPATH=. .venv/bin/flask db check && PYTHONPATH=. .venv/bin/python -m tools.schema_check
   ```
   El CI lo corre sobre una base vacía (upgrade → check → downgrade → upgrade). Si no pudiste correrlo, decilo.

## Convenciones (no las cambies sin preguntar)

| Qué | Cómo |
|---|---|
| Charset | `utf8mb4` / `utf8mb4_unicode_ci` en base y tablas |
| Estados y tipos | `String(n)` + `Enum` de Python (`class X(str, Enum)`); **no** `ENUM` de MySQL (el `.sql` de diseño lo dice, la base real no lo usa) |
| Dinero | `Numeric(10, 2)`; peso `Numeric(10, 3)`; porcentajes `Numeric(5, 2)` |
| Fechas | `DateTime` sin zona, en **UTC** (`_utcnow`); el frontend las convierte a hora local |
| Nombres | `chk_<tabla>_<campo>`, `uq_<tabla>_<cols>`, `ix_<tabla>_<cols>`, `fk_<tabla>_<col>`; **todo constraint nuevo con nombre** (sin nombre MySQL inventa `*_ibfk_N` y no se puede borrar de forma portable) |
| Auditoría (RBAC) | `created_by`/`updated_by` nullable, `ON DELETE RESTRICT`; `NULL` = sistema (migración o seed) |
| Normalización | 1FN–4FN/BCNF. **No persistas derivados**: costo y precio sugerido se calculan al leer (`pricing.compute_quote`). Excepción deliberada: `order_items.material_cost_per_kg`, copia del costo al cargar el pedido para que el presupuesto no cambie |

## Migraciones: checklist

1. `flask db migrate -m "..."` y **leé el archivo** antes de `upgrade`. Autogenerate no ve CHECK, renombres ni datos; agregá a mano lo que falte.
2. Cambios que pierden datos (`drop_column`, `drop_table`, tipo más chico, `unique` sobre datos existentes): **frená y avisá** con el riesgo y la alternativa sin pérdida.
3. CHECK o `NOT NULL` nuevos sobre tablas con datos: contá antes las filas que lo violarían en la base de desarrollo y decí el número.
4. Renombrar: `alter_column(new_column_name=..., existing_type=..., existing_nullable=...)`, nunca drop + add.
5. Migración de datos (`op.execute("UPDATE ...")`, `op.bulk_insert`) en la misma migración que el cambio de esquema, con `downgrade` que la deshaga o un comentario de por qué no se puede.
6. `downgrade` real, nunca `pass` ni `drop_constraint(None, ...)` (hay uno viejo así en `a1b86c4c24db`: no lo copies).
7. Una sola cabeza: `flask db heads` tiene que dar una línea. No edites migraciones ya aplicadas; corregí con una nueva.
8. **Aplicar a la base de desarrollo es acción del usuario o con su OK**: el contenedor monta `backend/` en vivo y un modelo sin migrar tumba la app (ya pasó con los logins).

## Errores de MySQL 8 que ya aparecieron

- **3959**: no se puede renombrar ni borrar una columna usada por un CHECK → borrá el CHECK, cambiá la columna y recrealo (también en `downgrade`).
- **3823**: no se permite un CHECK sobre una columna con FK `ON DELETE CASCADE` → la regla va en `services.py` (ej.: nadie se asigna roles a sí mismo).
- **`groups` es palabra reservada**: en SQL crudo, `` `groups` `` con backticks.
- Modo estricto activo (`STRICT_TRANS_TABLES`, `ONLY_FULL_GROUP_BY`): un string largo o un `GROUP BY` incompleto fallan, no se truncan.

## Seeds

Un seed nuevo se escribe como `seeds/seed_rbac.py`: idempotente, con `--dry-run` (rollback) y sin borrar nada (lo que sobra se informa). Los seeds viejos (`seed_operator`, `seed_materials`, `seed_cash_categories`) no tienen `--dry-run`: leelos antes de correrlos sobre una base con datos. Orden en una base nueva: `flask db upgrade` → `seeds.seed_operator` → `seeds.seed_rbac` (los demás según haga falta; varias migraciones ya cargan datos iniciales con `bulk_insert`).

## Consultar la base sin exponer credenciales

Nunca leas ni imprimas `backend/.env`. Para mirar la base de desarrollo, entrá por la app dentro del contenedor (solo lectura, salvo pedido explícito):
```bash
docker exec -w /app delivery3d-backend python -c "
from app import create_app; from app.extensions import db
with create_app().app_context(): print(db.session.execute(db.text('SELECT ...')).fetchall())"
```
Para probar migraciones desde cero, usá un MySQL descartable (`docker run --rm mysql:8.0` en otro puerto) y pasá `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` por entorno; nunca `root` del contenedor `mysql8` ni `DROP DATABASE` sobre `delivery3d`.
