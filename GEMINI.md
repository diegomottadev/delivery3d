# GEMINI.md — Delivery3D Project Guidelines

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

## Development & Workflow Rules (Workflow SSD)
- Follow **Spec-Driven Development (SSD / OpenSpec)** based on [workflow-ssd-plugin](https://github.com/diegomottadev/workflow-ssd-plugin):
  - **Living Scope:** Coarse-grained initiatives and build order tracked in `docs/scope/`.
  - **Spec Lifecycle:** Proposals, design, tasks, and delta specs in `openspec/changes/<change-name>/`.
  - **Workflow Depth Tiers:** Gated verification according to maturity (`prototype` | `alpha` | `beta` | `ga`).
  - **Independent Code Review:** Fresh-eyes pass over diffs with `code-reviewer` before `sync`/`archive`.
- **Strict TDD (Red -> Green -> Refactor):** Required on financial/pricing, state transitions, and business logic.
- **Precision & Data Integrity:**
  - Monetary values: `DECIMAL(10, 2)` (Python `Decimal` with `ROUND_HALF_UP`), never floating-point.
  - Weight/quantities: `DECIMAL(10, 3)` for weights in grams (milligram precision).
  - Database normalization: 1FN to 4FN/BCNF compliance, non-destructive cash integrity (`ON DELETE SET NULL`).
- **Workspace Skills (`.agents/skills/`):**
  - `architecture-first`: Architectural analysis and layering.
  - `coding-patterns`: Project conventions and idiomatic patterns.
  - `data-model`: Schema design and normalization.
  - `debug-workflow`: Root-cause investigation before fixes.
  - `explore-codebase`: High-signal architectural code survey.
  - `tdd-workflow`: Strict TDD cycles.

