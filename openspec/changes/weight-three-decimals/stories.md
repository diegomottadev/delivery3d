# User Stories (INVEST & SBE): weight-three-decimals

## User Story: US-01 — Ingreso y Almacenamiento de Peso con 3 Decimales

**As an** operador del taller  
**I want to** poder ingresar y visualizar el peso de cada pieza con hasta 3 decimales después de la coma (miligramos) en el formulario y ver ese valor preservado con total precisión en la base de datos  
**So that** los datos copiados desde el laminador Bambu Studio mantengan su exactitud matemática para el cálculo de consumo y costos.

### INVEST Evaluation
- **I**ndependent: Focalizado exclusivamente en el campo de peso de piezas.
- **N**egotiable: Se ajusta la escala decimal requerida (3 decimales).
- **V**aluable: Evita errores de redondeo en piezas de alta precisión o bajo gramaje.
- **E**stimable: Cambio directo en modelo, migración e input de frontend.
- **S**mall: Tamaño conciso para ejecución inmediata.
- **T**estable: Verificable con tests de API y de UI.

---

### Acceptance Criteria (Given-When-Then)

#### Scenario 1: Registro de pieza con 3 decimales
- **GIVEN** un operador en el formulario de alta de pedido
- **WHEN** ingresa `weight_g: 50.125`
- **THEN** el formulario acepta el valor sin truncar decimales y la orden se guarda en la base de datos registrando exactamente `50.125`.

#### Scenario 2: Consulta y serialización de pieza
- **GIVEN** una orden con un ítem cuyo peso es `12.345`
- **WHEN** se consulta el detalle de la orden vía API o interfaz
- **THEN** el campo `weight_g` retorna y visualiza `12.345` sin redondear a `12.35`.

#### Scenario 3: Pieza liviana de menos de 1 gramo
- **GIVEN** una pieza pequeña con peso `0.250` g
- **WHEN** se envía la solicitud de creación de orden
- **THEN** el sistema valida que el peso es mayor a 0 y lo almacena satisfactoriamente.

---

### Example Mapping Table
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | `weight_g: 50.125` | Formulario activo | Guardar pedido | Guardado y retornado como `"50.125"` |
| EX-02 | Happy Path | `weight_g: 0.785` | Formulario activo | Guardar pedido | Guardado y retornado como `"0.785"` |
| EX-03 | Boundary | `weight_g: 0.001` | Formulario activo | Guardar pedido | Guardado y retornado como `"0.001"` |
| EX-04 | Error Case | `weight_g: 0` | Formulario activo | Guardar pedido | Rechazado con 422 ("weight_g must be greater than 0") |
