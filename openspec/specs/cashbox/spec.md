# Living Specification: cashbox

> **The source of truth for what this domain does right now.**
> Every requirement is written in declarative business language.
> Updated automatically at the end of each `/change` during the **sync** step.

## Purpose
Gestionar el flujo de fondos de caja del taller de impresión 3D: registro de ingresos (señas de pedidos, cobro de saldo final al entregar, ingresos extraordinarios), registro de egresos operativos categorizados (filamentos, repuestos Bambu Lab A1, electricidad, embalaje), cálculo dinámico en tiempo real del saldo disponible y balance sin redundancias de persistencia (3FN), y soporte de moneda configurable para operaciones en Argentina (AR$) y Latinoamérica.

---

## Active Requirements

### Requirement: REQ-CASH-01 Registro de Movimientos de Caja
El sistema DEBE permitir registrar movimientos de ingresos y egresos vinculados opcionalmente a un pedido y obligatoriamente a un operador autenticado.

#### Scenarios
```gherkin
Scenario: Registro exitoso de egreso operativo
  GIVEN un operador autenticado
  WHEN envía POST /api/cashbox/movements con type="egreso", amount=15000.00, category="filamento", description="Bobina PLA Negro"
  THEN se crea el registro en cash_movements con type="egreso", monto positivo y user_id del operador
  AND el saldo neto de caja disminuye en 15000.00

Scenario: Rechazo de movimiento con monto negativo o cero
  GIVEN un operador autenticado
  WHEN envía POST /api/cashbox/movements con amount <= 0
  THEN el sistema rechaza la solicitud con código HTTP 422
```

#### Example Matrix (Specification by Example)
| ID | Caso | Tipo | Categoría | Monto | Resultado |
|---|---|---|---|---|---|
| EX-01 | Egreso insumos | egreso | filamento | 12500.50 | Éxito 201 |
| EX-02 | Ingreso extraordinario | ingreso | extraordinario | 8000.00 | Éxito 201 |
| EX-03 | Monto cero | egreso | repuestos | 0.00 | Error 422 |
| EX-04 | Monto negativo | ingreso | otro | -500.00 | Error 422 |
| EX-05 | Tipo inválido | prestamo | financiero | 1000.00 | Error 422 |
| EX-06 | Monto no finito | ingreso | otro | "NaN" / "Infinity" | Error 422 en `amount` |
| EX-07 | Más de 2 decimales | ingreso | otro | 100.005 | Error 422 en `amount` (no se redondea) |
| EX-08 | Ceros finales | ingreso | otro | 100.500 | Éxito 201, se guarda 100.50 |

---

### Requirement: REQ-CASH-02 Cálculo de Balance Dinámico On-Read (3FN)
El sistema DEBE calcular el balance actual de caja en tiempo real sumando todos los ingresos y restando todos los egresos, sin persistir saldos redundantes en base de datos.

#### Scenarios
```gherkin
Scenario: Consulta del resumen de caja
  GIVEN ingresos registrados por 50000.00 y egresos por 20000.00
  WHEN se consulta GET /api/cashbox/summary
  THEN el sistema retorna total_ingresos=50000.00, total_egresos=20000.00 y current_balance=30000.00
  AND adjunta currency_code y currency_symbol configurados en el taller
```

---

### Requirement: REQ-CASH-03 Cobro de Saldo de Pedidos
El sistema DEBE calcular el saldo pendiente de un pedido como **precio informado − suma de todos los ingresos asociados al pedido**, con piso en 0, y usar ese mismo valor al consultar el saldo, al cobrarlo desde caja y al cobrarlo en la entrega. Los egresos asociados al pedido no reducen lo cobrado. El cobro con monto explícito DEBE ser un número finito, mayor a 0, con a lo sumo 2 decimales y no mayor al saldo pendiente; si no, se rechaza con 422.

#### Scenarios
```gherkin
Scenario: Cobro de saldo pendiente al entregar pedido
  GIVEN un pedido con precio informado de 15000.00 y una seña previa de 5000.00
  WHEN se registra el cobro de saldo por 10000.00
  THEN se crea un movimiento de tipo "ingreso" con category="saldo_pedido" asociado al order_id
  AND el saldo pendiente del pedido queda en 0.00
```

#### Example Matrix (Specification by Example)
| ID | Caso | Input | Resultado |
|---|---|---|---|
| EX-01 | Saldo estándar | Precio 8000.00, seña 3000.00 | `pending_balance` 5000.00, `total_paid` 3000.00 |
| EX-02 | Cobro en entrega sin monto | Igual a EX-01 | Ingreso `saldo_pedido` 5000.00, pedido ENTREGADO |
| EX-03 | Cobro desde caja sin monto | Igual a EX-01 | 201, ingreso `saldo_pedido` 5000.00 |
| EX-04 | Sobrepago | Precio 8000.00, ingresos 9000.00 | `pending_balance` 0.00 |
| EX-05 | Sin precio | Pedido NUEVO sin cotización | `informed_price` 0.00, `pending_balance` 0.00 |
| EX-06 | Egreso asociado | Precio 15000.00, egreso 2000.00 | `pending_balance` 15000.00 |
| EX-07 | Monto mayor al saldo | Saldo 5000.00, monto 5000.01 | 422 |
| EX-08 | Monto inválido | "abc", "NaN", 0, -100, 100.005 | 422 |

---

### Requirement: REQ-CASH-04 Catálogos de Formas de Ingresos y Egresos (1FN a 4FN/BCNF)
El sistema DEBE persistir las categorías en dos tablas dedicadas en MySQL (`cash_income_categories` y `cash_expense_categories`), sembrando las categorías sugeridas (`['seña', 'saldo_pedido', 'extraordinario', 'otro']` y `['filamento', 'repuestos', 'servicios', 'embalaje', 'mantenimiento', 'otro']`), permitiendo agregar nuevas formas sin modificar el código fuente y enlazando claves foráneas en `cash_movements`.

#### Scenarios
```gherkin
Scenario: Consulta de categorías activas para modales de caja
  GIVEN el catálogo de categorías en la base de datos
  WHEN el frontend consulta GET /api/cashbox/categories/income o GET /api/cashbox/categories/expense
  THEN el sistema retorna las categorías activas para poblar los desplegables dinámicamente

Scenario: Creación de nueva forma de egreso
  GIVEN un operador autenticado
  WHEN envía POST /api/cashbox/categories/expense con code="marketing", name="Publicidad y Marketing"
  THEN el sistema crea la nueva categoría en cash_expense_categories con is_system=False e is_active=True
```

---

### Requirement: REQ-CASH-05 Pantalla de Configuración de Caja Separada
El sistema DEBE proveer una pantalla de Configuración de Caja en `/cashbox/settings`, accesible directamente desde el menú de navegación y desacoplada de la configuración de taller, para administrar y dar de alta formas de ingresos y egresos.

