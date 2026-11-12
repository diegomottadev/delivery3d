# Delta Specification: weight-three-decimals

## MODIFIED Requirements

### Requirement: Manual Order Intake (Alta Manual de Pedidos)
**Previous Behavior:**
El peso de las piezas (`order_items.weight_g`) se registraba y almacenaba con precisión de hasta 2 decimales (`DECIMAL(8, 2)`), y el input de interfaz limitaba la entrada a `maxFractionDigits={2}` y `min={0.1}`.

**New Behavior:**
El peso de las piezas (`order_items.weight_g`) DEBE registrarse y almacenarse con precisión de hasta 3 decimales (`DECIMAL(10, 3)`), y el input de interfaz DEBE permitir hasta 3 decimales (`maxFractionDigits={3}`, `min={0.001}` y `minFractionDigits={0}`).

---

## SBE Quality Checklist (Gojko Adzic Principles)
- [x] **Pure Domain Language:** Especifica la precisión requerida en gramos y miligramos sin atarse a librerías específicas.
- [x] **The Tester Test:** Permite a QA verificar el almacenamiento exacto de 3 decimales (`50.125`).
- [x] **Concrete Example Table:** Incluye valores con 3 decimales, valores menores a 1g y casos de validación.
- [x] **Atomicity:** Focalizado únicamente en el atributo `weight_g`.
