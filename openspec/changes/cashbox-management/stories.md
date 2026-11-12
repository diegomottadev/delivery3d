# User Stories: cashbox-management

## US-01: Configuración de Moneda del Taller
**Como** operador o administrador del taller 3D,  
**Quiero** configurar el código y símbolo de la moneda en la que opera el taller (por defecto AR$ / Pesos Argentinos, u otra moneda de Latinoamérica),  
**Para que** todos los costos, precios y registros de caja se visualicen con la denominación correcta.

### Criterios de Aceptación (AC)
- **AC-01.1:** En `WorkshopSettingsView`, el operador puede seleccionar una moneda predefinida (ARS, USD, CLP, COP, MXN, UYU, EUR) o ingresar valores personalizados de código (ej. `ARS`) y símbolo (ej. `AR$`).
- **AC-01.2:** Al guardar, los cambios se persisten en `workshop_settings.currency_code` y `workshop_settings.currency_symbol`.
- **AC-01.3:** La API rechaza códigos vacíos o mayores a 3 caracteres, y símbolos vacíos o mayores a 10 caracteres con código HTTP 422.

---

## US-02: Registro de Egresos Operativos
**Como** operador del taller,  
**Quiero** registrar egresos de dinero (compra de filamento, repuestos para la Bambu Lab A1, pago de electricidad, insumos de embalaje),  
**Para que** el taller lleve un control fidedigno de los gastos de producción y mantenimiento.

### Criterios de Aceptación (AC)
- **AC-02.1:** El operador puede registrar un egreso indicando monto mayor a 0, categoría (ej. `'filamento'`, `'repuestos'`, `'servicios'`, `'embalaje'`, `'otro'`) y una descripción detallada opcional.
- **AC-02.2:** El sistema registra el movimiento en `cash_movements` con `type = 'egreso'`, `user_id` del operador autenticado y timestamp actual en UTC.
- **AC-02.3:** Si el monto es <= 0 o no numérico, la API retorna error 422.

---

## US-03: Registro de Ingresos Extraordinarios
**Como** operador del taller,  
**Quiero** asentar ingresos de caja que no provienen directamente de un pedido en curso (ej. venta de piezas en stock, servicios de diseño, etc.),  
**Para que** el balance de caja refleje todo el dinero que ingresa al taller.

### Criterios de Aceptación (AC)
- **AC-03.1:** El operador puede registrar un ingreso extraordinario indicando monto > 0, categoría `'extraordinario'` u `'otro'`, y descripción explicativa.
- **AC-03.2:** El movimiento se crea con `type = 'ingreso'`, `order_id = null`, y queda visible en el historial y sumado al balance.

---

## US-04: Cálculo y Consulta del Balance en Tiempo Real
**Como** operador del taller,  
**Quiero** ver el balance neto disponible, el total acumulado de ingresos y el total acumulado de egresos,  
**Para que** pueda conocer la salud financiera inmediata del taller en cualquier momento.

### Criterios de Aceptación (AC)
- **AC-04.1:** El endpoint `GET /api/cashbox/summary` retorna `total_ingresos`, `total_egresos`, `current_balance` (`total_ingresos - total_egresos`), `currency_code` y `currency_symbol`.
- **AC-04.2:** El balance se calcula de forma dinámica en base a los registros de `cash_movements` sin persistir totales redundantes (3FN).
- **AC-04.3:** Si no hay movimientos, el balance y los totales se reportan en `0.00`.

---

## US-05: Listado Cronológico de Movimientos
**Como** operador del taller,  
**Quiero** explorar la cronología de todos los movimientos de caja con sus detalles,  
**Para que** pueda auditar quién registró cada gasto o cobro y verificar la fecha y concepto.

### Criterios de Aceptación (AC)
- **AC-05.1:** El endpoint `GET /api/cashbox/movements` retorna la lista de movimientos ordenados cronológicamente (el más reciente primero).
- **AC-05.2:** Cada movimiento incluye `id`, `type`, `amount`, `category`, `description`, `order_id`, `user_id`, `operator_username` y `created_at`.
- **AC-05.3:** Es posible filtrar por `type` (`ingreso` / `egreso`), `category` y `order_id`.

---

## US-06: Cobro de Saldo al Entregar Pedidos
**Como** operador del taller,  
**Quiero** cobrar el saldo pendiente de un pedido finalizado (`precio cotizado - seña previa`) con un solo clic,  
**Para que** el ingreso final quede automáticamente asentado en la caja y vinculado al pedido.

### Criterios de Aceptación (AC)
- **AC-06.1:** Al consultar el saldo de un pedido (`GET /api/cashbox/orders/<id>/balance`), el sistema retorna el precio cotizado, lo pagado previamente en señas y el saldo restante adeudado.
- **AC-06.2:** Al ejecutar el cobro de saldo (`POST /api/cashbox/orders/<id>/collect-balance`), se crea un movimiento de tipo `ingreso`, categoría `'saldo_pedido'`, con el monto adeudado asociado al `order_id`.
- **AC-06.3:** En el tablero operativo (`OrderBoard`), al presionar "Entregar" en un pedido listo que tiene saldo adeudado, el sistema ofrece una confirmación rápida para registrar el cobro del saldo restante en caja junto con la entrega.
- **AC-06.4:** No se permite registrar cobros de saldo mayores al importe adeudado o si el pedido ya tiene saldo cero.
