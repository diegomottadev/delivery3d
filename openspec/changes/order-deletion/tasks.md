# Implementation Tasks: order-deletion

- [x] 1. Backend: Servicio y Endpoint de Eliminación (TDD)
  - [x] 1.1 Implementar función `delete_order(order_id)` en `app/backend/app/orders/services.py`.
  - [x] 1.2 Implementar ruta `DELETE /api/orders/<int:order_id>` en `app/backend/app/orders/routes.py`.
  - [x] 1.3 Escribir tests en `app/backend/tests/test_orders_delete.py` verificando eliminación exitosa en diversos estados, desvinculación de caja (`order_id = NULL`), eliminación en cascada y manejo de 404.
  - [x] 1.4 Ejecutar suite completa de tests de backend y linter `ruff`.

- [x] 2. Frontend: Cliente API y Modal de Confirmación
  - [x] 2.1 Agregar `deleteOrder(orderId)` en `app/frontend/src/features/orders/ordersApi.js`.
  - [x] 2.2 Agregar botón de eliminar e implementar modal de confirmación en `OrderBoard.jsx` (todas las columnas del Kanban).
  - [x] 2.3 Agregar botón de eliminar e integrar modal de confirmación en `OrderList.jsx` (tabla de pedidos).
  - [x] 2.4 Escribir/actualizar tests unitarios en `OrderBoard.test.js` y `OrderList.test.js` para validar la apertura del modal y la confirmación de eliminación.
  - [x] 2.5 Ejecutar test suite de frontend y build de producción.

- [x] 3. Cierre y Sincronización OpenSpec
  - [x] 3.1 Actualizar especificación viva en `openspec/specs/orders/spec.md`.

