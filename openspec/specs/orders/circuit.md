# Technical Circuit: orders

> **Living Technical Memory: How work runs and where execution flows.**
> Updated across changes: `order-intake`, `quote-calculation`, `order-lifecycle`.

**Last Updated:** 2026-10-02 · **Changes that shaped this:** `order-intake`, `quote-calculation`, `order-lifecycle`, `refactor-money-domain-solid`

---

## Entry Points

| Entry Point | Trigger Mechanism | File:Line |
|---|---|---|
| `POST /api/orders` | HTTP POST (Alta de pedido) | `backend/app/orders/routes.py:18` |
| `GET /api/orders` | HTTP GET (Listar pedidos) | `backend/app/orders/routes.py:35` |
| `GET /api/orders/<id>` | HTTP GET (Detalle de pedido) | `backend/app/orders/routes.py:43` |
| `POST /api/orders/<id>/quote` | HTTP POST (Calcular cotización) | `backend/app/orders/routes.py:53` |
| `POST /api/orders/<id>/quote/confirm` | HTTP POST (Confirmar cotización) | `backend/app/orders/routes.py:68` |
| `POST /api/orders/<id>/approve` | HTTP POST (Aprobar pedido con/sin seña) | `backend/app/orders/routes.py:84` |
| `POST /api/orders/<id>/start-printing` | HTTP POST (Comenzar impresión) | `backend/app/orders/routes.py:96` |
| `POST /api/orders/<id>/mark-ready` | HTTP POST (Marcar como listo) | `backend/app/orders/routes.py:108` |
| `POST /api/orders/<id>/deliver` | HTTP POST (Entregar/Cobrar) | `backend/app/orders/routes.py:120` |
| `GET /api/orders/<id>/history` | HTTP GET (Historial de auditoría) | `backend/app/orders/routes.py:132` |
| `DELETE /api/orders/<id>` | HTTP DELETE (Eliminar orden permanentemente) | `backend/app/orders/routes.py:199` |

---

## Execution Path

### 1. Order Intake Flow
```
POST /api/orders
  → routes.py::create_order()
      → validate_order_intake_payload(payload)     [schemas.py]
      → services.py::create_order(...)
          → Client resolution (busca client_id o crea Client nuevo)
          → db.session.add(Order(status=NUEVO, client_id, user_id))
          → services.py::_build_order_item(order_id, item) por cada pieza   (compartido con update_order)
              → material/filamento existen? → si no, MaterialNotFoundError / FilamentNotFoundError
              → services.py::_resolve_cost_per_kg(item, material)
                  → material_cost_per_kg (si no es None) → cost_per_kg → costo del material → money.py::DEFAULT_MATERIAL_COST_PER_KG
          → db.session.add(OrderStatusHistory(from_status=None, to_status=NUEVO))
          → db.session.commit()
```

### 2. Quote Calculation & Confirmation
```
POST /api/orders/<id>/quote
  → routes.py::calculate_quote()
      → services.py::calculate_quote(order_id, quote_vars)
          → Guard: order.status == NUEVO (si no → 409 Conflict)
          → pricing.py::compute_quote(order_items, quote_vars)
              → labor_cost = round(labor_cost_per_hour * (labor_time_minutes / 60))
          → Upsert OrderQuote (persiste printer_id, labor_cost_per_hour, labor_time_minutes; sin columnas de costo calculado)
          → db.session.commit()
          → services.py::get_order_pricing(order) (cálculo on-read para response con desglose pricing)

POST /api/orders/<id>/quote/confirm
  → routes.py::confirm_quote()
      → services.py::confirm_quote(order_id, informed_price, changed_by)
          → Guard: order.status == NUEVO and order.quote is not None
          → Atomic UPDATE orders SET status = PRESUPUESTADO WHERE id = :id AND status = 'nuevo'
          → Update order.quote.informed_price y quoted_at
          → Add OrderStatusHistory('nuevo' → 'presupuestado')
          → db.session.commit()
```

### 3. Lifecycle Transition Flow
```
POST /api/orders/<id>/approve | /start-printing | /mark-ready | /deliver
  → routes.py::<transition_endpoint>()
      → Guard: payload deposit_amount validado (solo permitido en /approve)
      → services.py::transition_order(order_id, target_status, changed_by, deposit_amount, collect_balance, final_payment_amount)
          → Validar deposit_amount (finito, ≥ 0, ≤ DECIMAL_10_2_MAX, ≤ 2 decimales)        → si no, DepositValidationError (422)
          → state_machine.py::is_valid_transition(previous_status, target_status)          → si no, InvalidOrderStateError (409)
          → Capture `previous_status` BEFORE update
          → Si ENTREGADO + collect_balance:
              → cashbox/balance.py::pending_balance(order)                                  ← ÚNICA fuente del saldo
              → Validar final_payment_amount (finito, > 0, ≤ máx, ≤ 2 decimales, ≤ saldo)  → si no, 422
          → Si seña > 0 o cobro > 0: _system_income_category(order_id, "seña"|"saldo_pedido")
              → filter_by(code, is_system=True, is_active=True)                             → si no, InvalidOrderStateError (409)
          ── nada se escribió hasta acá ──
          → Optimistic update: UPDATE orders SET status = target WHERE id = order_id AND status = previous_status
          → If rowcount == 0 → race condition / conflict (rollback & 409)
          → Add OrderStatusHistory(from_status, to_status, changed_by)
          → cashbox/services.py::add_movement(type=INGRESO, amount, category_id, description, order_id, user_id)  (sin commit)
          → db.session.commit()   (except Exception → rollback)
```

### 4. Order Deletion Flow
```
DELETE /api/orders/<id>
  → routes.py::delete_order_route(order_id)
      → Guard: @login_required
      → services.py::delete_order(order_id)
          → Guard: order exists (si no → 404 OrderNotFoundError)
          → Disassociate cash movements: CashMovement.query.filter_by(order_id=order.id).update({"order_id": None})
          → db.session.delete(order) (cascada delete-orphan a order_items, order_quotes, order_status_history)
          → db.session.commit()
```

---

## File Map

| File | Responsibility |
|---|---|
| `backend/app/orders/models.py` | Modelos `Order`, `OrderItem`, `OrderQuote`, `OrderStatusHistory`, enum `OrderStatus` |
| `backend/app/orders/routes.py` | Endpoints REST de la API (`orders_bp`) |
| `backend/app/orders/services.py` | Lógica de negocio transaccional, orquestación de DB y guardas |
| `backend/app/orders/schemas.py` | Validación de payloads y serialización de modelos |
| `backend/app/orders/pricing.py` | Función pura `compute_quote` (cálculo de costos y precio sugerido con `Decimal`) |
| `backend/app/money.py` | Constantes y reglas puras de dinero: `DECIMAL_10_2_MAX`, `DEFAULT_MATERIAL_COST_PER_KG`, `CENT`, `has_sub_cent_precision` |
| `backend/app/cashbox/balance.py` | Saldo pendiente del pedido (`informed_price`, `total_paid`, `pending_from`, `pending_balance`) |
| `backend/app/orders/state_machine.py` | Matriz de transiciones permitidas del ciclo de vida |
| `backend/app/clients/models.py` | Modelo `Client` (canales de contacto, Instagram, teléfono) |
| `backend/app/materials/models.py` | Modelo `Material` (catálogo de filamentos con costo por kg) |
| `backend/app/materials/routes.py` | Endpoint `GET /api/materials` para listar catálogo de filamentos |
| `backend/app/cashbox/models.py` | Modelo `CashMovement` (movimientos de caja, señas vinculadas a `order_id`) |
| `frontend/src/features/orders/ordersApi.js` | Cliente HTTP centralizado (Axios) con endpoints de órdenes, cotizaciones y ciclo de vida |
| `frontend/src/features/orders/OrderIntakeForm.jsx` | Modal de alta manual multi-pieza con selección de material y validaciones |
| `frontend/src/features/orders/QuoteModal.jsx` | Modal de cálculo de costos (Bambu A1), desglose y confirmación de precio informado |
| `frontend/src/features/orders/OrderList.jsx` | Tabla PrimeReact DataTable de pedidos con badges de estado y fecha |
| `frontend/src/features/orders/OrderBoard.jsx` | Tablero Kanban por columnas con acciones de avance de estado, registro de seña e historial |

---

## Known Gotchas / Traps Verified

- ⚠️ **Core UPDATE in-memory session mutation:** Al ejecutar `db.session.execute(db.update(Order)...)`, SQLAlchemy sincroniza el atributo en memoria inmediatamente (`order.status = target_status`). Por tanto, `previous_status` DEBE guardarse en una variable local antes de ejecutar el update; de lo contrario `OrderStatusHistory.from_status` registraría erróneamente el nuevo estado. Verificado 2026-09-14.
- ⚠️ **Zero Persisted Computed Totals (3FN):** `production_cost` y `suggested_sale_price` no existen en la base de datos. Cualquier endpoint que devuelva cotizaciones llama a `get_order_pricing(order)` al vuelo. Verificado 2026-09-14.
- ⚠️ **Atomic Deposit in CashBox:** La seña no es un campo de `Order`, sino un `CashMovement`. Si se aprueba con seña, se inserta en la misma transacción para garantizar balance contable. Verificado 2026-09-14.
- ⚠️ **Movimientos automáticos solo vía `add_movement`:** nunca construir `CashMovement(...)` en `orders/services.py` ni usar `create_movement` dentro de una transición (hace commit y rompe la atomicidad). Toda validación que deba cortar sin efectos va ANTES del UPDATE Core. Verificado 2026-10-02.
- ⚠️ **`x or y` con montos:** nunca usar `or` para elegir entre montos: trata un 0 numérico como ausente (bug corregido en `schemas.py` y `_resolve_cost_per_kg` usando `is None`). Verificado 2026-10-02.
