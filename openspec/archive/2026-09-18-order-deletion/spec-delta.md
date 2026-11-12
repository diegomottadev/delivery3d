# Specification Delta: order-deletion

## Added Requirements

### Requirement: Order Deletion (Eliminación de Pedidos con Confirmación)
El sistema DEBE permitir a los operadores autenticados eliminar permanentemente un pedido en cualquier etapa del ciclo de vida (`nuevo`, `presupuestado`, `aprobado`, `imprimiendo`, `listo`, `entregado`, `cancelado`) mediante `DELETE /api/orders/<id>`.
- La eliminación DEBE borrar en cascada las piezas asociadas (`order_items`), el snapshot de cotización (`order_quotes`) y el historial de estados (`order_status_history`).
- Si la orden posee movimientos de caja registrados (señas o cobros), estos movimientos DEBEN conservarse para garantizar la fidelidad del saldo de caja física, actualizando `cash_movements.order_id = NULL` (`ON DELETE SET NULL`).
- En la interfaz de usuario, cada pedido debe disponer de un botón de eliminación en todas las columnas del tablero y en la tabla de órdenes.
- La interfaz DEBE exigir confirmación explícita mediante una ventana modal antes de enviar la petición de borrado.
