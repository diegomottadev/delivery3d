# Delivery3D

[![CI](https://github.com/diegomottadev/delivery3d/actions/workflows/ci.yml/badge.svg)](https://github.com/diegomottadev/delivery3d/actions/workflows/ci.yml)

Sistema de gestión de **pedidos y caja** para un taller de impresión 3D (Bambu Lab A1): alta de pedidos, cotización con costos reales de material, energía, máquina y mano de obra, ciclo de vida del pedido y caja diaria con señas y cobros.

## Funcionalidades

- **Pedidos:** alta manual con cliente y piezas, tablero por estado (nuevo → presupuestado → aprobado → imprimiendo → listo → entregado) e historial de cambios.
- **Cotización:** cálculo con filamento, merma, consumo eléctrico, amortización de la impresora, mano de obra y margen; precio sugerido y precio informado al cliente.
- **Caja:** ingresos y egresos por categoría, seña al aprobar, cobro del saldo al entregar y saldo por pedido.
- **Configuración del taller:** constantes de costo, impresoras y categorías de caja.
- **Seguridad:** autenticación JWT, límite de intentos de login y errores sin detalles internos. El control de acceso por roles y permisos (RBAC) está en desarrollo en la rama [`feat/rbac`](https://github.com/diegomottadev/delivery3d/tree/feat/rbac).

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.13, Flask (API REST modular), Flask-SQLAlchemy, Flask-Migrate (Alembic), PyJWT |
| Base de datos | MySQL 8.0 (InnoDB, `utf8mb4_unicode_ci`), esquema normalizado |
| Frontend | React 18, PrimeReact 8, PrimeFlex, Axios, React Router 6 |
| Tests | pytest contra MySQL real · Jest + Testing Library |
| CI | GitHub Actions: ruff + pytest (con MySQL de servicio) y jest + build |

## Cómo levantarlo

### Requisitos
- Docker y Docker Compose.
- MySQL 8 accesible en el host, en el puerto `3306`, con las bases `delivery3d` y `delivery3d_test` y un usuario con permisos sobre ambas.
- La red Docker externa `personal-net`. Si no la tenés: `docker network create personal-net`.

### Pasos
```bash
# 1. Configuración: copiar la plantilla y completar los <...>
cp app/backend/.env.example app/backend/.env
#    Para generar secretos: python3 -c "import secrets; print(secrets.token_urlsafe(48))"

# 2. Levantar backend (http://localhost:5000) y frontend (http://localhost:3000)
docker compose up -d --build

# 3. Crear el esquema y los datos iniciales
docker compose exec backend flask db upgrade
docker compose exec backend python -m seeds.seed_operator   # usuario "operador" con SEED_OPERATOR_PASSWORD
docker compose exec backend python -m seeds.seed_materials
```

Después entrá a http://localhost:3000 con el usuario `operador` y la contraseña que pusiste en `SEED_OPERATOR_PASSWORD`.

### Sin Docker (desarrollo)
```bash
cd app/backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt
PYTHONPATH=. .venv/bin/flask db upgrade && PYTHONPATH=. .venv/bin/flask run

cd app/frontend && npm ci && npm start
```

## Tests

```bash
cd app/backend && PYTHONPATH=. .venv/bin/pytest -q && .venv/bin/ruff check app/ tests/ seeds/
cd app/frontend && npm test -- --watchAll=false
```

Los tests del backend corren contra una base MySQL real (`DB_TEST_NAME`), no contra mocks. El pipeline de CI los ejecuta en cada push a `main` y a las ramas `feat/**`.

## Cómo se trabaja en este proyecto

- **Spec-Driven Development (OpenSpec):** cada cambio parte de una propuesta, un diseño y specs con ejemplos en `openspec/`. Ver [`openspec/project.md`](openspec/project.md) y los cambios en [`openspec/changes/`](openspec/changes/).
- **TDD estricto** en dinero, precios y transiciones de estado: primero el test en rojo, después la implementación.
- **Dinero siempre en `Decimal`** con redondeo `ROUND_HALF_UP` y columnas `DECIMAL(10, 2)`.
- **Desarrollo asistido por IA (Claude Code):** skills propios del proyecto en [`.claude/skills/`](.claude/skills/), uno de revisión OWASP Top 10 y otro de buenas prácticas de backend medido con evaluaciones, y un informe del proceso en [`docs/informes/`](docs/informes/).

## Seguridad

Los secretos (credenciales de base, `JWT_SECRET_KEY`) viven solo en `app/backend/.env`, que nunca se versiona. [`app/backend/.env.example`](app/backend/.env.example) tiene solo marcadores.
