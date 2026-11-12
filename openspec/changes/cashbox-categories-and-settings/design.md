# Technical Design: cashbox-categories-and-settings

## 1. Relational Architecture & Normalization Analysis (1FN - 4FN / BCNF)

### 1FN (Atomicidad & Claves Primarias)
- Toda columna contiene valores atómicos simples (cadenas, booleanos, enteros, timestamps).
- Cada tabla cuenta con una clave primaria técnica `id INT AUTO_INCREMENT PRIMARY KEY`.

### 2FN (Dependencia Funcional Completa)
- No existen claves primarias compuestas con atributos no clave dependiendo de solo una parte de la clave. Todos los atributos dependen únicamente de `id`.

### 3FN (Sin Dependencias Transitivas)
- No hay atributos derivados o calculados en las tablas de categorías.
- `CashMovement` mantiene relaciones foráneas referenciales hacia la categoría correspondiente.

### 4FN / BCNF (Sin Dependencias Multivaluadas Independientes)
- Las categorías de ingresos y egresos son entidades de catálogo completamente desacopladas de pedidos, piezas y clientes.
- Esquema de tablas:

```sql
CREATE TABLE cash_income_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cash_income_categories_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cash_expense_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cash_expense_categories_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE cash_movements
    ADD COLUMN income_category_id INT NULL,
    ADD COLUMN expense_category_id INT NULL,
    ADD CONSTRAINT fk_cash_movements_income_cat FOREIGN KEY (income_category_id) REFERENCES cash_income_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_cash_movements_expense_cat FOREIGN KEY (expense_category_id) REFERENCES cash_expense_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE;
```

## 2. API Endpoints

### Categorías de Ingresos
- `GET /api/cashbox/categories/income?all=true|false`: Retorna listado de categorías de ingresos (por defecto solo `is_active=True`, o todas si `all=true`).
- `POST /api/cashbox/categories/income`: Crea nueva categoría de ingresos (`{ code, name, description }`).
- `PUT /api/cashbox/categories/income/<id>`: Actualiza nombre, descripción o estado activo (`{ name, description, is_active }`).

### Categorías de Egresos
- `GET /api/cashbox/categories/expense?all=true|false`: Retorna listado de categorías de egresos.
- `POST /api/cashbox/categories/expense`: Crea nueva categoría de egresos (`{ code, name, description }`).
- `PUT /api/cashbox/categories/expense/<id>`: Actualiza nombre, descripción o estado activo (`{ name, description, is_active }`).

### Movimientos de Caja
- `POST /api/cashbox/movements`: Valida que la categoría enviada (`category` o `category_id`) exista en la tabla de catálogo correspondiente al tipo (`ingreso` en `cash_income_categories` y `egreso` en `cash_expense_categories`) y esté activa.

## 3. Frontend Architecture

- **`CashboxSettingsView.jsx` (`/cashbox/settings`)**:
  - Pestañas o páneles paralelos con `DataTable` de PrimeReact para Ingresos y Egresos.
  - Columnas: Código, Nombre, Descripción, Tipo (Sistema / Personalizada), Estado (Tag / InputSwitch), Acciones (Editar).
  - Diálogos para "Nueva Categoría" y "Editar Categoría".
- **`CashboxView.jsx` (`/cashbox`)**:
  - Reemplazo de listas constantes en memoria por `useEffect` que consume `getCashIncomeCategories()` y `getCashExpenseCategories()`.
  - Dropdowns poblados dinámicamente.
- **Navegación (`App.js`)**:
  - Item "Configuración de Caja" añadido al menú y breadcrumbs en `/cashbox/settings`.
