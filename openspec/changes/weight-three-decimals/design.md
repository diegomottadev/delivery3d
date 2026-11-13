# Design: weight-three-decimals

## Involved Files (real paths)
- `app/backend/app/orders/models.py`
- `app/backend/migrations/versions/d9401ab23e7f_change_order_items_weight_precision_to_3_decimals.py`
- `app/backend/migrations/schema_design_normalized.sql`
- `app/backend/tests/orders/test_intake.py`
- `app/frontend/src/features/orders/OrderIntakeForm.jsx`
- `app/frontend/src/features/orders/OrderIntakeForm.test.js`

## Technical Approach
1. **Model & Database Precision:**
   - Columna `order_items.weight_g`: se modifica de `DECIMAL(8, 2)` a `DECIMAL(10, 3)`.
   - Soporta valores atómicos desde `0.001` hasta `9999999.999`.
   - Cumple estrictamente con 1FN (tipos de datos adecuados y atómicos).
2. **Frontend Input Behavior:**
   - En `OrderIntakeForm.jsx`, el campo `InputNumber` de peso:
     - `min={0.001}`
     - `maxFractionDigits={3}`
     - `minFractionDigits={0}`
     - Permite que el usuario ingrese tanto enteros (`50`) como decimales (`50.5`, `50.125`).

## Schema Changes / Migrations
```sql
ALTER TABLE order_items MODIFY COLUMN weight_g DECIMAL(10, 3) NOT NULL;
```

## Decisions (Short ADR)
- **Decisión:** Usar `DECIMAL(10, 3)` para `weight_g`.
  - **Alternativa descartada:** Almacenar peso en miligramos enteros (`weight_mg INT`).
  - **Razón:** El laminador Bambu Studio y las interfaces de usuario operan en gramos (`g`). Cambiar la unidad a miligramos generaría fricción en la UI y requeriría transformaciones de ida y vuelta en toda la aplicación. `DECIMAL(10, 3)` modela gramos con 3 cifras decimales de forma directa y limpia.

---

## Inventory of Built Artifacts

### Database
- [ ] **Modify** table `order_items`: columna `weight_g` pasa a `DECIMAL(10, 3)`.

### Backend
- [ ] **Modify** `app/backend/app/orders/models.py`: `OrderItem.weight_g = db.Column(db.Numeric(10, 3), nullable=False)`.

### Frontend
- [ ] **Modify** `app/frontend/src/features/orders/OrderIntakeForm.jsx`: `maxFractionDigits={3}`, `min={0.001}`.

### Tests
- [ ] **Modify** `app/backend/tests/orders/test_intake.py`: Test de persistencia de peso con 3 decimales (`12.345`).
- [ ] **Modify** `app/frontend/src/features/orders/OrderIntakeForm.test.js`: Test de edición/ingreso con 3 decimales.
