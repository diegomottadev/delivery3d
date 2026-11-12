# Technical Circuit: cashbox

> **Living Technical Memory: How work runs and where execution flows.**

**Last Updated:** 2026-10-02 · **Changes that shaped this:** `cashbox-management`, `refactor-money-domain-solid`

---

## Entry Points

| Entry Point | Trigger Mechanism | File:Line |
|---|---|---|
| Summary de Caja | HTTP GET `/api/cashbox/summary` | `backend/app/cashbox/routes.py` |
| Listar Movimientos | HTTP GET `/api/cashbox/movements` | `backend/app/cashbox/routes.py` |
| Registrar Movimiento | HTTP POST `/api/cashbox/movements` | `backend/app/cashbox/routes.py` |
| Listar Categorías Ingreso | HTTP GET `/api/cashbox/categories/income` | `backend/app/cashbox/routes.py` |
| Crear Categoría Ingreso | HTTP POST `/api/cashbox/categories/income` | `backend/app/cashbox/routes.py` |
| Listar Categorías Egreso | HTTP GET `/api/cashbox/categories/expense` | `backend/app/cashbox/routes.py` |
| Crear Categoría Egreso | HTTP POST `/api/cashbox/categories/expense` | `backend/app/cashbox/routes.py` |
| Consultar Saldo Pedido | HTTP GET `/api/cashbox/orders/<order_id>/balance` | `backend/app/cashbox/routes.py` |
| Cobrar Saldo Pedido | HTTP POST `/api/cashbox/orders/<order_id>/collect-balance` | `backend/app/cashbox/routes.py` |
| Cobrar en Entrega Pedido | HTTP POST `/api/orders/<order_id>/deliver` (con flag `collect_balance`) | `backend/app/orders/routes.py` |

---

## Execution Path

```
POST /api/cashbox/movements
  → @login_required (auth/security.py)
  → cashbox/routes.py::create_movement_route()
      → Validate type in ('ingreso', 'egreso')
      → Validate amount > 0 (Decimal)
      → Resolve category in cash_income_categories or cash_expense_categories
      → Link income_category_id or expense_category_id
      → cashbox/services.py::create_movement()
          → cashbox/services.py::add_movement()      (keyword-only, NO commit — reutilizable dentro de otras transacciones)
              → validaciones (tipo, monto finito/> 0/≤ máx/≤ 2 decimales, categoría activa, pedido existe)
              → db.session.add(movement)
          → db.session.commit()
          → return movement.to_dict()

GET /api/cashbox/orders/<id>/balance
  → cashbox/services.py::get_order_balance_info(order_id)              → 404 si no existe
      → cashbox/balance.py::informed_price(order), total_paid(order.id) (1 SUM de ingresos), pending_from(...)
      → float() solo al armar la respuesta

POST /api/cashbox/orders/<id>/collect-balance
  → cashbox/services.py::collect_order_balance(order_id, user_id, amount)
      → cashbox/balance.py::pending_balance(order)   (Decimal, sin pasar por float)
      → saldo ≤ 0 → 422; monto inválido / > saldo / > 2 decimales → 422
      → create_movement(category="saldo_pedido")

GET /api/cashbox/summary
  → @login_required
  → cashbox/routes.py::get_summary_route()
      → cashbox/services.py::get_cash_summary()
          → SUM(amount WHERE type = 'ingreso')
          → SUM(amount WHERE type = 'egreso')
          → balance = total_ingresos - total_egresos
          → Query workshop_settings for currency_code, currency_symbol
          → return {total_ingresos, total_egresos, current_balance, currency_code, currency_symbol}
```

---

## File Map

| File | Responsibility |
|---|---|
| `backend/app/cashbox/models.py` | Modelos ORM para `cash_movements`, `cash_income_categories`, `cash_expense_categories` |
| `backend/app/cashbox/services.py` | Lógica de negocio financiero, balance dinámico y CRUD de categorías de caja; `add_movement` (sin commit) y `create_movement` |
| `backend/app/cashbox/balance.py` | Única fuente del saldo pendiente de un pedido |
| `backend/app/money.py` | Constantes y reglas puras de dinero |
| `backend/app/cashbox/routes.py` | Endpoints REST de movimientos y categorías de caja |
| `backend/app/settings/models.py` | Modelo con `currency_code` y `currency_symbol` |
| `frontend/src/features/cashbox/cashboxApi.js` | Cliente Axios para servicios de caja y categorías |
| `frontend/src/features/cashbox/CashboxView.jsx` | Vista de caja diaria y finanzas con métricas, tabla y carga dinámica de categorías |
| `frontend/src/features/cashbox/CashboxSettingsView.jsx` | Vista dedicada de configuración y administración de categorías de caja |
| `frontend/src/features/orders/OrderBoard.jsx` | Tablero Kanban integrado con cobro de saldo en entrega |

---

## Shared Dependencies

| Shared Component | Shared With | Impact If Changed |
|---|---|---|
| `add_movement` | `orders` domain (`transition_order`) | Seña y saldo de entrega se registran con estas validaciones; un cambio aquí afecta approve/deliver |
| `balance.py::pending_balance` | `orders` domain (`transition_order`) | Cambiar la fórmula del saldo cambia consulta, cobro desde caja y cobro en entrega a la vez |
| Categorías de sistema `seña`, `saldo_pedido` | `orders` domain | Si faltan o se desactivan, approve con seña y deliver con cobro devuelven 409 |
| `WorkshopSettings` | `orders` domain (cotización), `settings` domain | Contiene configuración global del taller incluyendo moneda y costos |
