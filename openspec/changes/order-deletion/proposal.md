# Proposal: order-deletion

- **Status:** `done`
- **Scope:** `taller-impresion-3d`
- **Depth:** `ga`

## 1. Problem Statement
Actualmente no existe la funcionalidad para eliminar un pedido del sistema una vez creado. En el trabajo diario de un taller de impresión 3D, ocurren cancelaciones de clientes, pedidos de prueba, errores accidentales de carga o presupuestos descartados que el operador necesita poder borrar en cualquiera de sus etapas (`nuevo`, `presupuestado`, `aprobado`, `imprimiendo`, `listo`, `entregado`).
Para prevenir eliminaciones accidentales de pedidos en producción activa o con pagos, se requiere una confirmación explícita mediante un modal de confirmación antes de efectuar el borrado.

## 2. Proposed Solution
1. **Backend (`DELETE /api/orders/<int:order_id>`):**
   - Servicio `delete_order(order_id)` en `app/orders/services.py`.
   - Si la orden tenía movimientos de caja asociados (`cash_movements` por señas o cobros), estos movimientos se desvinculan fijando `order_id = NULL` respetando la regla `ON DELETE SET NULL` (garantizando 1FN-4FN y la integridad del arqueo físico de caja).
   - Se eliminan en cascada (`delete-orphan`) sus piezas (`order_items`), parámetros de cotización (`order_quotes`) e historial de auditoría (`order_status_history`).
   - Endpoint protegido con `@login_required` retornando 200 `{ message: "..." }` o 404 si la orden no existe.
2. **Frontend:**
   - Función `deleteOrder(orderId)` en `frontend/src/features/orders/ordersApi.js`.
   - Botón de eliminación (ícono papelera `pi pi-trash` con color de peligro y tooltip) visible en todas las tarjetas de pedidos del tablero Kanban (`OrderBoard.jsx`) en cualquier estado/columna, así como en la tabla general de pedidos (`OrderList.jsx`).
   - Diálogo modal de confirmación (`Dialog`) que detalla el ID de la orden, nombre del cliente, estado actual y advertencia clara de que la acción es irreversible antes de disparar la petición HTTP.
   - Refresco automático del tablero y notificación toast de confirmación.

## 3. Impact & Risk Analysis
- **Integridad Referencial:** `order_items`, `order_quotes` y `order_status_history` tienen configurada la cascada `delete-orphan`. `cash_movements.order_id` tiene `ON DELETE SET NULL`. La eliminación no produce anomalías ni orfandad.
- **Riesgo:** Bajo. La confirmación obligatoria en modal previene clics no intencionales.
