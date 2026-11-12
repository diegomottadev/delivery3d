# Design: refactor-money-domain-solid

## Involved Files (real paths)
- `backend/app/money.py` — ya existe (`CENT`, `has_sub_cent_precision`); se le agregan constantes.
- `backend/app/cashbox/balance.py` — **nuevo**, módulo hoja.
- `backend/app/cashbox/services.py` — `add_movement`, `create_movement`, `get_order_balance_info`, `collect_order_balance`, constante `DECIMAL_10_2_MAX`.
- `backend/app/orders/services.py` — `create_order`, `update_order`, `_pricing_items`, `_pending_balance`, `transition_order`.
- `backend/app/orders/pricing.py` — solo el import de `DECIMAL_10_2_MAX`.
- `backend/tests/cashbox/test_services.py`, `backend/tests/cashbox/test_routes.py`, `backend/tests/orders/test_lifecycle.py`, `backend/tests/orders/test_intake.py`.

## Technical Approach
Patrón analógico existente: `orders/pricing.py` ya es una función pura sin dependencia de Flask, y `orders/state_machine.py` es un módulo hoja con una sola responsabilidad. Se aplica el mismo criterio a las reglas de dinero.

### 1. Constantes de dinero → `app/money.py`
```python
DECIMAL_10_2_MAX = Decimal("99999999.99")
DEFAULT_MATERIAL_COST_PER_KG = Decimal("18000.00")
```
`pricing.py`, `orders/services.py` y `cashbox/services.py` importan desde aquí y borran sus copias. `pricing.py` conserva `TWO_PLACES` (no se toca su lógica).

### 2. Saldo pendiente → `app/cashbox/balance.py` (nuevo)
```python
def informed_price(order: Order) -> Decimal: ...                 # Decimal("0.00") si no hay cotización/precio
def total_paid(order_id: int) -> Decimal: ...                     # SUM(ingresos del pedido); egresos excluidos
def pending_from(informed: Decimal, paid: Decimal) -> Decimal:    # max(0, informed - paid) — pura
def pending_balance(order: Order) -> Decimal:                     # pending_from(informed_price(order), total_paid(order.id))
```
Depende solo de `app.extensions`, `app.cashbox.models` y `app.orders.models`. Lo importan `cashbox/services.py` y `orders/services.py`; no hay ciclo (`balance.py` no importa ningún `services`; los `models` solo importan `app.extensions`).
- `orders/services.py::_pending_balance` se elimina y se usa `pending_balance`.
- `get_order_balance_info` calcula `informed_price(order)` y `total_paid(order.id)` una vez y deriva el saldo con `pending_from` (una sola SUM); convierte a `float` **solo** al armar el dict (contrato HTTP sin cambios).
- `collect_order_balance` obtiene el pedido y llama a `pending_balance(order)`; desaparece `Decimal(str(float))` (`cashbox/services.py:432`). Mantiene `OrderBalanceError(404)` si el pedido no existe y `OrderBalanceError(422)` si no hay saldo.

### 3. `add_movement` sin commit → `cashbox/services.py`
```python
def add_movement(*, type, amount, category=None, description=None, order_id=None, user_id=1, category_id=None) -> CashMovement:
    """Valida y hace db.session.add(). NO hace commit: la transacción la decide el llamador."""

def create_movement(...misma firma...) -> CashMovement:
    movement = add_movement(...)
    db.session.commit()
    return movement
```
`create_movement` conserva su firma posicional actual (la usan tests y la ruta).

En `transition_order`, la categoría de sistema se resuelve **antes del UPDATE Core** (junto con las validaciones de monto), y solo si hace falta (seña > 0 o cobro > 0):
```python
def _system_income_category(order_id: int, code: str) -> CashIncomeCategory:
    category = CashIncomeCategory.query.filter_by(code=code, is_system=True, is_active=True).first()
    if category is None:
        raise InvalidOrderStateError(f"Order {order_id}: cash category '{code}' unavailable")
    return category
```
- Filtra por `is_system=True`: una categoría de usuario cuyo nombre o código colisione (p. ej. "seña"/"sena" bajo `utf8mb4_unicode_ci`) nunca se usa (EX-18). **No** se usa la búsqueda `code OR name` de `create_movement`.
- Como se valida antes del UPDATE, no hace falta rollback: no se tocó nada.
- Dentro del `try` existente, los dos `CashMovement(...)` construidos a mano se reemplazan por `add_movement(type="ingreso", amount=..., category_id=category.id, description=..., order_id=order.id, user_id=changed_by)`. `add_movement` vuelve a validar (monto, categoría activa); un `CashboxValidationError` ahí sería una violación de invariante y cae en el `except Exception` existente (rollback + re-raise → 500), que es lo correcto para un estado imposible.
- No se agrega ninguna cláusula `except` nueva al `try`.

La ruta ya mapea `InvalidOrderStateError` → 409 `{"error": ...}` en approve (`orders/routes.py:140`, vía `_transition_route`) y en deliver (`orders/routes.py:183`), así que las rutas no cambian.

### 4. Armado de ítems → `orders/services.py`
```python
def _resolve_cost_per_kg(item: dict, material: Material | None) -> Decimal: ...
def _build_order_item(order_id: int, item: dict) -> OrderItem: ...   # resuelve material/filamento, lanza *NotFoundError
```
`create_order` hace `db.session.add(_build_order_item(...))`; `update_order` hace `order.items.append(_build_order_item(...))`. `_pricing_items` usa `DEFAULT_MATERIAL_COST_PER_KG`.

## Constants / Enums / Magic IDs
- `DECIMAL_10_2_MAX`, `DEFAULT_MATERIAL_COST_PER_KG`, `CENT` en `app/money.py`.
- Códigos de categoría de sistema `seña` y `saldo_pedido`: sembrados por la migración `411d9c4af9cc` con `is_system=True`; `update_income_category` impide desactivarlos. Se mantienen como literales en `orders/services.py` (moverlos a constantes queda fuera de alcance).

## Security & Permissions
Sin cambios. Todas las rutas siguen con `login_required`; `user_id` de los movimientos sigue viniendo de `g.current_user_id` vía `changed_by`.

## ⚠️ High-Risk Files / Modules
- `backend/app/cashbox/services.py` y `backend/app/orders/pricing.py` están declarados de alto riesgo en `openspec/project.md`. En `pricing.py` el único cambio permitido es el import.
- `transition_order`: el `previous_status` debe seguir capturándose antes del UPDATE Core (comentario en el código). `pending_balance(order)` debe calcularse antes del UPDATE, como hoy.
- Atomicidad: `add_movement` NUNCA debe hacer commit. Un test en `tests/cashbox/test_services.py` llama a `add_movement(...)`, luego `db.session.rollback()`, y afirma 0 movimientos. El error de categoría se detecta antes del UPDATE, así que no hay nada que revertir.

## Impact on Data / Integraciones
Ninguno. Sin migraciones, sin backfill. Frontend sin cambios.

## Schema Changes / Migrations
Ninguno.

## Decisions (Short ADR)
- **Decision:** si falta la categoría de sistema, rechazar la transición con 409, validando antes del UPDATE y filtrando por `is_system=True`.
  - **Discarded alternative:** mantener el comportamiento actual (guardar el ingreso con `income_category_id = NULL`).
  - **Reason:** un ingreso sin categoría desaparece de los reportes por categoría sin aviso; con datos sembrados por migración la condición no ocurre en uso normal, así que el riesgo de bloquear operaciones reales es nulo.
- **Decision:** `balance.py` dentro de `cashbox/` y no en `app/money.py`.
  - **Discarded alternative:** ponerlo en `money.py`.
  - **Reason:** `money.py` queda puro (sin DB); el saldo depende de consultas a `cash_movements`, que es dominio de caja.
- **Decision:** no unificar mensajes de error ni el CRUD de categorías.
  - **Reason:** cambian contratos visibles o tocan mucho código sin reducir riesgo; se dejan para otro change.

---

## Inventory of Built Artifacts

### Database
- Ninguno.

### Backend
- [ ] **Modify** `app/money.py` — agrega `DECIMAL_10_2_MAX`, `DEFAULT_MATERIAL_COST_PER_KG` *(→ US-03)*
- [ ] **Create** `app/cashbox/balance.py::informed_price`, `total_paid`, `pending_from`, `pending_balance` *(→ US-01)*
- [ ] **Modify** `app/cashbox/services.py::get_order_balance_info`, `collect_order_balance` — usan `balance.py`, sin roundtrip float *(→ US-01)*
- [ ] **Create** `app/cashbox/services.py::add_movement` — validación sin commit; `create_movement` la envuelve *(→ US-02)*
- [ ] **Create** `app/orders/services.py::_system_income_category` — resuelve categoría de sistema o lanza `InvalidOrderStateError` *(→ US-02)*
- [ ] **Modify** `app/orders/services.py::transition_order` — usa `pending_balance`, `_system_income_category` (antes del UPDATE) y `add_movement` *(→ US-01, US-02)*
- [ ] **Create** `app/orders/services.py::_resolve_cost_per_kg`, `_build_order_item` *(→ US-03)*
- [ ] **Modify** `app/orders/pricing.py` — solo import de `DECIMAL_10_2_MAX` *(→ US-03)*

### Frontend
- Ninguno.

### Tests
- [ ] **Create** tests de caracterización EX-01..EX-06, EX-07/EX-09 (vinculación + usuario), EX-13, EX-14, EX-14c *(→ US-01..03)*
- [ ] **Create** test de atomicidad de `add_movement` (sin commit) *(→ US-02)*
- [ ] **Create** tests RED EX-15, EX-16, EX-18 y guarda EX-17 *(→ US-02)*

**No se toca:** rutas (`*/routes.py`), modelos, migraciones, frontend, lógica de `compute_quote`, CRUD de categorías.
