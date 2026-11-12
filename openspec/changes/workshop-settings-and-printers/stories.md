# User Stories (INVEST & SBE): workshop-settings-and-printers

## User Story: US-01 — Administrar Valores Constantes del Taller

**As an** operador del taller  
**I want to** definir y actualizar los valores constantes del taller (costo kWh, merma/purga, tarifa de mano de obra, tiempo estándar de operador, margen multiplicador e impresora por defecto)  
**So that** estos parámetros se precarguen automáticamente en todas las nuevas cotizaciones sin tener que reescribirlos manualmente.

### INVEST Evaluation
- **I**ndependent: Gestionable como entidad aislada `workshop_settings`.
- **N**egotiable: Los campos configurables pueden ampliarse a futuro.
- **V**aluable: Elimina tareas manuales repetitivas y estandariza costos.
- **E**stimable: Modelo simple con endpoints REST directos.
- **S**mall: Confinado al módulo de settings.
- **T**estable: Validable con tests HTTP y restricciones de schema.

---

### Acceptance Criteria (Given-When-Then)

#### Scenario 1: Obtener constantes predeterminadas
- **GIVEN** un operador autenticado
- **WHEN** consulta `GET /api/settings`
- **THEN** el sistema retorna status 200 con los valores de `kwh_cost`, `waste_purge_pct`, `labor_cost_per_hour`, `default_labor_time_minutes`, `profit_multiplier` y `default_printer_id`.

#### Scenario 2: Actualizar constantes operativas
- **GIVEN** un operador autenticado
- **WHEN** envía `PUT /api/settings` con `kwh_cost: 290.00`, `labor_cost_per_hour: 700.00` y `default_labor_time_minutes: 20`
- **THEN** el sistema valida que los valores sean no-negativos, persiste los cambios y retorna status 200 con los valores actualizados.

#### Scenario 3: Rechazar valores negativos
- **GIVEN** un operador autenticado
- **WHEN** envía `PUT /api/settings` con un valor negativo (ej. `kwh_cost: -50`)
- **THEN** el sistema responde con status 422 y un mensaje de error descriptivo.

---

## User Story: US-02 — Administrar Catálogo de Impresoras

**As an** operador del taller  
**I want to** registrar y mantener el listado de impresoras del taller con su potencia y costo horario de amortización  
**So that** al cotizar pueda elegir la máquina exacta que realizará el trabajo con sus especificaciones técnicas reales.

### Acceptance Criteria (Given-When-Then)

#### Scenario 1: Registrar nueva impresora
- **GIVEN** un operador autenticado
- **WHEN** envía `POST /api/printers` con `name: "Creality K1"`, `power_watts: 350`, `cost_per_hour: 120.00`
- **THEN** el sistema crea la impresora con status 201 y la disponibiliza para cotizaciones.

#### Scenario 2: Validación de nombre único
- **GIVEN** una impresora existente con nombre "Bambu Lab A1"
- **WHEN** se intenta crear otra impresora con el mismo nombre
- **THEN** el sistema rechaza la solicitud con status 409 o 422 indicando duplicidad.

---

## User Story: US-03 — Cotización con Selección de Impresora y Mano de Obra Horaria/Minutera

**As an** operador del taller  
**I want to** seleccionar la impresora y cargar el tiempo de trabajo del operador en horas y minutos  
**So that** la cotización calcule con precisión matemática el costo humano y de máquina, con pre-llenado de valores pero permitiendo su ajuste individual.

### Acceptance Criteria (Given-When-Then)

#### Scenario 1: Cálculo exacto de mano de obra
- **GIVEN** una tarifa horaria de `$650.00/h` y un tiempo de `0 horas` y `15 minutos` (0.25 h)
- **WHEN** se solicita el cálculo de cotización
- **THEN** el costo de mano de obra calculado es exactamente `$162.50` (`650.00 * (15 / 60)`).

#### Scenario 2: Pre-llenado editable en el modal
- **GIVEN** un pedido en estado `nuevo` y las constantes del taller configuradas
- **WHEN** se abre el modal de cotización
- **THEN** los campos aparecen precargados con los valores globales, pero el operador puede editarlos sin alterar las constantes del taller.

#### Scenario 3: Desglose y cálculo reactivo en frontend
- **GIVEN** el operador modificando los inputs de horas o minutos
- **WHEN** se modifican los valores numéricos
- **THEN** la tarjeta visual calcula inmediatamente el total proporcional antes de confirmar.

---

### Example Mapping Table
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | Tarifa $650/h, 15 min, Bambu A1 (120W, $100/h) | Pedido `nuevo` | POST `/api/orders/<id>/quote` | Mano de obra = $162.50, calculo exitoso |
| EX-02 | Happy Path | Tarifa $800/h, 1h 30m (90 min) | Pedido `nuevo` | POST `/api/orders/<id>/quote` | Mano de obra = $1200.00 |
| EX-03 | Boundary | 0 horas, 0 minutos de mano de obra | Pedido `nuevo` | POST `/api/orders/<id>/quote` | Mano de obra = $0.00 |
| EX-04 | Error Case | Tarifa horaria negativa (-$100/h) | Pedido `nuevo` | POST `/api/orders/<id>/quote` | Rechazado con 422 Unprocessable Entity |
