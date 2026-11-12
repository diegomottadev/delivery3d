# CLAUDE.md — Delivery3D Project Guidelines

Sistema de Gestión de Pedidos y Caja para Taller de Impresión 3D (Bambu Lab A1).

## Tech Stack & Architecture
- **Backend:** Python (Flask modular REST API), Flask-SQLAlchemy, Flask-Migrate, PyMySQL.
- **Frontend:** React 18 (PrimeReact 8, PrimeFlex, Axios) basado en la plantilla Babylon React.
- **Database:** MySQL 8.0 (InnoDB, charset `utf8mb4_unicode_ci`), contenedor Docker `mysql8`. Esquema normalizado (1FN a 4FN/BCNF).
- **Security:** Autenticación JWT (`login_required` guard, claims `sub`).

## Commands

### Backend (`backend/`)
- Run development server:
  ```bash
  cd backend && PYTHONPATH=. .venv/bin/flask run
  ```
- Run tests:
  ```bash
  cd backend && PYTHONPATH=. .venv/bin/pytest -v
  ```
- Run linter:
  ```bash
  cd backend && .venv/bin/ruff check app/ tests/ seeds/
  ```
- Run migrations:
  ```bash
  cd backend && PYTHONPATH=. .venv/bin/flask db upgrade
  ```
- Seed initial data:
  ```bash
  cd backend && PYTHONPATH=. .venv/bin/python -m seeds.seed_operator
  cd backend && PYTHONPATH=. .venv/bin/python -m seeds.seed_materials
  ```

### Frontend (`frontend/`)
- Run development server:
  ```bash
  cd frontend && npm start
  ```
- Run tests:
  ```bash
  cd frontend && npm test -- --watchAll=false
  ```
- Production build:
  ```bash
  cd frontend && npm run build
  ```

## Development & Workflow Rules
- Follow **Spec-Driven Development (SSD / OpenSpec)**: `openspec/project.md`, `openspec/specs/`, `openspec/changes/`.
- Strict TDD (Red -> Green -> Refactor) on financial/pricing and state transition modules.
- Monetary values must use `DECIMAL(10, 2)` (Python `Decimal` with `ROUND_HALF_UP`), never raw floating-point calculations.
