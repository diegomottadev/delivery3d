---
name: flask-backend-practices
description: Buenas prácticas para el backend Flask de Delivery3D (backend/app). Usar siempre que se cree, modifique, revise o refactorice código Python del backend — blueprints/routes.py, services.py, models.py (Flask-SQLAlchemy), schemas.py de validación, pricing/state machine, dinero con Decimal, migraciones Alembic (flask db) o tests pytest — aunque el pedido no diga "buenas prácticas": agregar un endpoint, un campo, una tabla, arreglar un bug del backend o "revisá este módulo" también aplican.
---

# Buenas prácticas backend — Flask (Delivery3D)

El código del repo ya muestra cómo se trabaja: tomá `app/orders/` como módulo de referencia (routes → schemas → services → models) y `backend/tests/conftest.py` para los fixtures. Este skill cubre lo que el código **no** muestra. Para seguridad, aplicá también **owasp-security**.

## Reglas que el código no te va a decir

1. **Una spec aprobada manda sobre tu criterio.** Antes de cambiar un comportamiento, buscá en `openspec/specs/<dominio>/` y `openspec/archive/*/spec-delta.md`. Si tu cambio la contradice, frená y preguntá: lo que parece un bug puede ser una decisión del negocio protegida por tests (pasó con el borrado de pedidos en cualquier estado).
2. **Nunca borres, debilites ni saltees un test para que la suite pase.** Si un test parece incorrecto, avisá: suele estar protegiendo una spec.
3. **Migraciones: leé el archivo generado antes de `flask db upgrade`.** Autogenerate no detecta todo (tipos, constraints con nombre, datos). Avisá explícitamente si hay `drop_column`, `drop_table`, cambio de tipo que trunque o `unique` sobre datos existentes, con el riesgo y la alternativa sin pérdida. Renombrar = `alter_column(new_column_name=..., existing_type=..., existing_nullable=...)`, nunca drop + add. **MySQL 8 rechaza renombrar o borrar una columna usada por un CHECK** (error 3959): eliminá y recreá el constraint alrededor del cambio, también en el `downgrade`.
4. **Cambio de contrato JSON = cambio en el frontend.** Si renombrás o quitás una clave de respuesta, nombrá los archivos de `frontend/src/features/` afectados y preguntá si hay que aceptar ambas claves por compatibilidad.
5. **Sin dependencias nuevas sin avisar.** El proyecto valida a mano en `schemas.py` a propósito: no sumes Pydantic, marshmallow ni similares.
6. **Errores:** los services lanzan excepciones de dominio con nombre (nunca `ValueError` genérico ni status HTTP); el route las traduce. Nunca `jsonify(error=str(exc)), 500`: lo no controlado va al handler global de `app/__init__.py`.
7. **Dinero:** `Decimal(str(x))`, `quantize(CENT, ROUND_HALF_UP)`, columnas `Numeric(10, 2)`; `float` solo al serializar.
8. **No refactorices por tu cuenta** la API pública, el schema de BD ni módulos sin tests: proponelo y esperá confirmación.
9. **No reportes éxito sin la prueba:** salida de `cd backend && PYTHONPATH=. .venv/bin/pytest -q && .venv/bin/ruff check app/ tests/ seeds/`. Si no pudiste correr algo, decilo.

## Qué va en cada capa (para revisar)

| Archivo | Debe | No debe |
|---|---|---|
| `routes.py` | `json_body()`, validar con `schemas.py`, llamar al service, mapear excepciones a 404/409/422 | `db.session`, `Model.query`, `commit()`, cálculos de negocio |
| `schemas.py` | Validar tipos y rangos, devolver dict limpio o `ValidationError(errors)` | Tocar la base |
| `services.py` | Reglas, `commit()`/`rollback()`, excepciones de dominio | `jsonify`, `request`, status HTTP |
| `pricing.py`, `state_machine.py`, `money.py` | Lógica pura, testeable sin DB | Importar `flask` o `db` |

## Modo auditoría

Cuando pidan revisar código existente, no generes código de entrada. Recorré **una categoría por vez** y cerrala antes de pasar a la siguiente:

1. **Capas:** routes que tocan el ORM, hacen `commit()` o calculan negocio; services que devuelven HTTP.
2. **Dominio:** reglas fuera de lugar (estado escrito a mano en vez de `transition_order`, precios fuera de `pricing.py`), `ValueError` genéricos, services-dios.
3. **Datos y dinero:** `float` en cálculos, N+1 en listados, constraints faltantes en la base.
4. **Errores y transacciones:** `str(exc)` en 500, `except Exception` que tragan, commits sin rollback, objetos mutados antes de terminar de validar.
5. **Tests:** reglas sin test, mocks de `db.session`, tests acoplados entre sí.

Por cada hallazgo, una fila. Formato fijo:

| # | Categoría | Archivo:línea | Problema | Principio | Refactor mínimo |
|---|---|---|---|---|---|
| 1 | Capas | `backend/app/<módulo>/routes.py:<desde>-<hasta>` | La ruta valida a mano, instancia el modelo y hace `commit()` | Routes sin ORM (SRP) | Extract Function `validate_<entidad>` → `schemas.py`, `create_<entidad>` → `services.py` |

El refactor mínimo nombra el patrón (Extract/Move Function…) y las funciones concretas. Si no hay hallazgos en una categoría, decilo con lo que verificaste.
