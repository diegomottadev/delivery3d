# Design: order-lifecycle

> **Superseded schema notice:** igual que `order-intake` y `quote-calculation`, este change se adaptó sobre el esquema normalizado (1FN-4FN). La seña opcional registrada al aprobar un pedido **NO se almacena como columna `deposit_amount` en `orders`** (3FN/normalización). En su lugar, cuando `deposit_amount > 0`, se registra un movimiento real en la tabla `cash_movements` (`type="ingreso"`, `category="seña"`, `order_id=order.id`, `user_id=changed_by`) dentro de la misma transacción atómica. Por ende, no requiere migración DDL adicional sobre `orders`.

## Involved Files (real paths — implementados)
- `app/backend/app/orders/state_machine.py` — define el mapa de transiciones válidas `VALID_TRANSITIONS` y `is_valid_transition(from_status, to_status)`.
- `app/backend/app/orders/services.py` — implementa `transition_order(order_id, target_status, changed_by, deposit_amount=None)` con guarda optimista y registro opcional en `CashMovement`, y `get_order_history(order_id)`.
- `app/backend/app/orders/routes.py` — agrega `POST /api/orders/<order_id>/approve`, `POST /api/orders/<order_id>/start-printing`, `POST /api/orders/<order_id>/mark-ready`, `POST /api/orders/<order_id>/deliver`, `GET /api/orders/<order_id>/history`.
- `app/backend/tests/orders/test_lifecycle.py` — 23 tests de integración sobre MySQL real (`delivery3d_test`).
- `app/frontend/src/features/orders/OrderBoard.jsx` — diferido (tablero por columnas de estado).
- `app/frontend/src/features/orders/ordersApi.js` — diferido (funciones cliente para transiciones).

## Technical Approach
`state_machine.py` declara el mapa de transiciones válidas como datos:
```python
VALID_TRANSITIONS: dict[str, str] = {
    OrderStatus.PRESUPUESTADO.value: OrderStatus.APROBADO.value,
    OrderStatus.APROBADO.value: OrderStatus.IMPRIMIENDO.value,
    OrderStatus.IMPRIMIENDO.value: OrderStatus.LISTO.value,
    OrderStatus.LISTO.value: OrderStatus.ENTREGADO.value,
}
```
`services.transition_order` valida que `order.status` tenga como único destino permitido `target_status` según `VALID_TRANSITIONS`; si no, levanta `InvalidOrderStateError` (mapeado a `409 Conflict`). Cada transición exitosa agrega una fila a `order_status_history` (`changed_by` resuelto server-side desde el JWT).

El `deposit_amount` solo se acepta como parámetro opcional en la transición `PRESUPUESTADO → APROBADO`; en cualquier otra transición se rechaza con `422 Unprocessable Entity` si se envía en el body. Si `deposit_amount > 0`, se inserta una fila en `cash_movements`.

Este change asume avance secuencial estricto (`proposal.md` — Out of Scope: reversión de estado), por lo que `VALID_TRANSITIONS` es un mapa 1 a 1 hacia adelante.

`services.get_order_history(order_id)` expone la orden con la relación `status_history` (`lazy="selectin"` ordenado cronológicamente por `changed_at`).

**Concurrencia:** `transition_order` ejecuta el `UPDATE` de `orders` con una guarda optimista:
```python
result = db.session.execute(
    db.update(Order)
    .where(Order.id == order_id, Order.status == previous_status)
    .values(status=target_status)
)
```
Si `result.rowcount == 0` (carrera con otra transición concurrente), hace rollback y levanta `InvalidOrderStateError` (`409 Conflict`).
*Nota de implementación aprendida:* el `UPDATE` de SQLAlchemy muta `order.status` en memoria al ejecutarse, por lo que `previous_status` se captura en una variable local antes de ejecutar la sentencia para garantizar la correcta auditoría en `order_status_history`.

## Constants / Enums / Magic IDs
- Reutiliza `OrderStatus` (`nuevo`, `presupuestado`, `aprobado`, `imprimiendo`, `listo`, `entregado`, `cancelado`).
- `VALID_TRANSITIONS` en `state_machine.py` es la única fuente de verdad sobre transiciones legales.

## Security & Permissions
- Todos los endpoints están protegidos por `@login_required`. `changed_by` se obtiene de `g.current_user_id`.

## ⚠️ High-Risk Files / Modules
- `state_machine.py`: previene saltos ilegales de estado productivo y mantiene trazabilidad de la orden.
- Transacción atómica en `services.transition_order`: agrupa `UPDATE orders`, `INSERT order_status_history` y opcionalmente `INSERT cash_movements`.

## Decisions (Short ADR)
- **Decision:** Seña vinculada a `cash_movements` en vez de columna en `orders`.
  - **Reason:** Cumple 3FN/4FN evitando duplicar montos financieros en la orden; la tabla `cash_movements` ya existía en el esquema normalizado.
- **Decision:** Endpoints específicos por transición (`/approve`, `/start-printing`, `/mark-ready`, `/deliver`).
  - **Reason:** Semántica clara, validaciones diferenciadas por endpoint (`deposit_amount` solo en `/approve`).
- **Decision:** Guarda optimista por status (`WHERE id = :id AND status = :expected`).
  - **Reason:** Evita locks pesimistas en MySQL manteniendo consistencia ante concurrencia.

---

## Inventory of Built Artifacts

### Database
- Esquema existente sin modificaciones adicionales (la migración `a1b86c4c24db` ya contenía `orders`, `order_status_history` y `cash_movements`).

### Backend
- [x] **Create** `state_machine.py::VALID_TRANSITIONS` + `is_valid_transition`
- [x] **Create** `services.py::transition_order` con guarda optimista y registro en `cash_movements`
- [x] **Create** `services.py::get_order_history`
- [x] **Modify** `routes.py` — endpoints `/approve`, `/start-printing`, `/mark-ready`, `/deliver`, `GET /history`
- [x] **Create** `tests/orders/test_lifecycle.py` — 23 tests de integración

### Frontend
- [ ] **Create** `OrderBoard.jsx` — diferido
- [ ] **Create** `ordersApi.js` transiciones — diferido
