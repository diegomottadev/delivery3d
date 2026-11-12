# User Stories (INVEST & SBE): refactor-money-domain-solid

> Historias técnicas: el "usuario" es quien mantiene el sistema (persona o agente de IA). El valor es que una regla de dinero se cambie en un solo lugar.

---

## User Story: US-01 — Saldo pendiente con una sola fuente de verdad

**As a** responsable del taller
**I want** que el saldo pendiente de un pedido sea el mismo al consultarlo, al cobrarlo desde caja y al cobrarlo en la entrega
**So that** nunca se cobre de más ni de menos por una diferencia entre cálculos

### INVEST Evaluation
- **I**ndependent: no depende de US-02/US-03.
- **N**egotiable: la ubicación del módulo puede cambiar.
- **V**aluable: elimina la clase de bug ya ocurrida (copias divergentes).
- **E**stimable: 1 módulo nuevo + 3 llamadores.
- **S**mall: < 60 líneas netas.
- **T**estable: EX-01..EX-06.

### Acceptance Criteria (Given-When-Then)
#### Scenario 1: Saldo consistente
- **GIVEN** un pedido LISTO con precio 8000.00 y seña 3000.00
- **WHEN** se consulta el saldo, se cobra desde caja o se entrega con cobro de saldo
- **THEN** en los tres casos el saldo es 5000.00
#### Scenario 2: Sobrepago
- **GIVEN** un pedido con precio 8000.00 e ingresos por 9000.00
- **WHEN** se consulta el saldo
- **THEN** el saldo es 0.00
#### Scenario 3: Egresos no cuentan como cobro
- **GIVEN** un pedido con precio 15000.00 y un egreso de 2000.00 asociado
- **WHEN** se consulta el saldo
- **THEN** el saldo es 15000.00

### Example Mapping Table
Ver EX-01 a EX-06 en `spec-delta.md`.

---

## User Story: US-02 — Cobros automáticos con las validaciones de caja

**As a** responsable del taller
**I want** que la seña y el saldo registrados por las transiciones pasen por las mismas validaciones que cualquier movimiento de caja
**So that** ningún ingreso quede sin categoría y cualquier regla nueva de caja aplique también a esos cobros

### INVEST Evaluation
- **I**ndependent: puede entregarse sin US-01 (usa el cálculo actual).
- **N**egotiable: el código HTTP del rechazo (409) es negociable.
- **V**aluable: evita ingresos sin categoría en reportes.
- **E**stimable: 1 función nueva + 2 sitios de uso.
- **S**mall: sí.
- **T**estable: EX-07..EX-10, EX-15..EX-18.

### Acceptance Criteria (Given-When-Then)
#### Scenario 1: Seña vinculada
- **GIVEN** un pedido PRESUPUESTADO
- **WHEN** se aprueba con seña de 1500.00
- **THEN** existe 1 ingreso de 1500.00 vinculado a la categoría de sistema "Seña / Anticipo"
#### Scenario 2: Seña cero
- **GIVEN** la categoría `seña` eliminada y un pedido PRESUPUESTADO
- **WHEN** se aprueba con seña 0.00
- **THEN** el pedido queda APROBADO
#### Scenario 3: Categoría faltante
- **GIVEN** la categoría `seña` eliminada y un pedido PRESUPUESTADO
- **WHEN** se aprueba con seña de 1500.00
- **THEN** responde 409, el pedido sigue PRESUPUESTADO, no hay movimientos ni entradas nuevas en el historial
#### Scenario 4: Categoría de saldo inactiva al entregar
- **GIVEN** la categoría de sistema `saldo_pedido` inactiva y un pedido LISTO con saldo 5000.00
- **WHEN** se entrega con cobro de saldo
- **THEN** responde 409, el pedido sigue LISTO y no hay ingreso `saldo_pedido`
#### Scenario 5: Categoría de usuario homónima no reemplaza a la de sistema
- **GIVEN** la categoría de sistema `seña` eliminada y una categoría de usuario llamada "seña"
- **WHEN** se aprueba con seña de 1500.00
- **THEN** responde 409 y no se registra ningún movimiento

### Example Mapping Table
Ver EX-07 a EX-10 y EX-15 a EX-18 en `spec-delta.md`.

---

## User Story: US-03 — Constantes de dinero y armado de ítems en un solo lugar

**As a** quien mantiene el sistema
**I want** que el tope DECIMAL(10,2) y el costo por kg por defecto tengan nombre y un único lugar, y que el alta y la edición de pedidos armen los ítems con la misma función
**So that** cambiar un valor por defecto o una regla de ítem no requiera buscar copias

### INVEST Evaluation
- **I**ndependent: sí.
- **N**egotiable: nombres de constantes.
- **V**aluable: elimina 3 copias de `18000.00`, 2 de `DECIMAL_10_2_MAX`, ~30 líneas duplicadas.
- **E**stimable: sí.
- **S**mall: sí.
- **T**estable: EX-11..EX-14c + suite existente de pricing/intake.

### Acceptance Criteria (Given-When-Then)
#### Scenario 1: Costo por defecto en alta
- **GIVEN** un ítem con filamento PLA, sin costo ni material
- **WHEN** se da de alta el pedido
- **THEN** el ítem tiene costo 18000.00
#### Scenario 2: Costo por defecto en edición
- **GIVEN** un pedido existente
- **WHEN** se edita con un ítem con filamento PLA, sin costo ni material
- **THEN** el ítem tiene costo 18000.00
#### Scenario 3: Costo informado prevalece
- **GIVEN** un ítem con costo 20000.00 y material de 18000.00
- **WHEN** se da de alta el pedido
- **THEN** el ítem tiene costo 20000.00

### Example Mapping Table
Ver EX-11 a EX-14c en `spec-delta.md`.
