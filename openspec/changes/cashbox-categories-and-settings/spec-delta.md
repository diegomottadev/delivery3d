# Specification Delta: cashbox-categories-and-settings

## Added Requirements

### REQ-CASH-04 Catálogos de Formas de Ingresos y Egresos en Base de Datos (1FN-4FN/BCNF)
El sistema DEBE persistir las categorías de ingresos en `cash_income_categories` y las de egresos en `cash_expense_categories`, con identificadores únicos, código inmutable para categorías de sistema, nombre descriptivo y estado activo/inactivo.

#### Scenarios
```gherkin
Scenario: Obtención de categorías activas para selección en caja
  GIVEN el catálogo con categorías activas e inactivas
  WHEN el cliente consulta GET /api/cashbox/categories/income
  THEN se retornan únicamente las categorías de ingresos con is_active=True

Scenario: Creación exitosa de nueva categoría personalizada de egreso
  GIVEN un operador autenticado
  WHEN envía POST /api/cashbox/categories/expense con code="capacitacion", name="Cursos y Capacitación"
  THEN se crea la categoría con is_system=False e is_active=True
  AND el código HTTP es 201 Created

Scenario: Rechazo de código duplicado
  GIVEN una categoría existente con code="filamento"
  WHEN se intenta crear otra con code="filamento"
  THEN el sistema rechaza la operación con código HTTP 409 Conflict
```

### REQ-CASH-05 Configuración de Caja Diaria y Administración de Categorías
El sistema DEBE proveer una pantalla accesible en `/cashbox/settings` desde el menú de navegación para administrar las categorías de ingresos y egresos.
