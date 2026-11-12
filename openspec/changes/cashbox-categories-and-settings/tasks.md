# Implementation Tasks: cashbox-categories-and-settings

- [x] 1. Base de Datos y Modelos (1FN-4FN/BCNF)
  - [x] 1.1 Definir modelos `CashIncomeCategory` y `CashExpenseCategory` en `backend/app/cashbox/models.py`.
  - [x] 1.2 Agregar claves foráneas `income_category_id` y `expense_category_id` en `CashMovement`.
  - [x] 1.3 Crear migración Alembic incremental con creación de tablas y sembrado inicial de categorías sugeridas (`411d9c4af9cc_add_cash_categories_tables.py`).
  - [x] 1.4 Aplicar migración en base de datos `delivery3d`.
  - [x] 1.5 Crear script de seed `backend/seeds/seed_cash_categories.py`.

- [x] 2. Servicios Backend y Pruebas Unitarias (TDD)
  - [x] 2.1 Implementar servicios de catálogo: `list_income_categories`, `create_income_category`, `update_income_category`, `list_expense_categories`, `create_expense_category`, `update_expense_category`.
  - [x] 2.2 Actualizar `create_movement` para resolver y vincular la categoría desde la base de datos según el tipo.
  - [x] 2.3 Implementar endpoints REST en `backend/app/cashbox/routes.py`.
  - [x] 2.4 Escribir suite de pruebas backend en `backend/tests/cashbox/test_categories.py`.
  - [x] 2.5 Verificar que todos los tests pasen (135 tests en backend) y linter limpio (`ruff check`).

- [x] 3. Frontend & Vistas de Configuración de Caja
  - [x] 3.1 Agregar métodos de categorías en `frontend/src/features/cashbox/cashboxApi.js`.
  - [x] 3.2 Actualizar `CashboxView.jsx` para consumir categorías dinámicamente desde la API.
  - [x] 3.3 Crear vista `CashboxSettingsView.jsx` para administración de categorías (Ingresos y Egresos).
  - [x] 3.4 Agregar ruta `/cashbox/settings`, breadcrumbs y opción en menú en `App.js`.
  - [x] 3.5 Escribir tests unitarios en frontend (`CashboxSettingsView.test.js` y actualización de `CashboxView.test.js`).
  - [x] 3.6 Ejecutar suite de frontend (38 tests pasando en 9 suites) y verificar compilación limpia (`npm run build`).

- [x] 4. Sincronización y Cierre
  - [x] 4.1 Actualizar especificaciones en `openspec/specs/cashbox/spec.md` y `openspec/specs/cashbox/circuit.md`.
  - [x] 4.2 Actualizar `openspec/project.md`.
