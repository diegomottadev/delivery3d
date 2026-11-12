# Specification Delta: split-screen-dashboard

## Added Requirements

### REQ-DASH-01 Tablero Split-Screen Integrado (Project.md §5)
El sistema DEBE presentar en la pantalla principal (`/`) el tablero Kanban de pedidos a la izquierda y el módulo financiero de caja a la derecha.

### REQ-DASH-02 Sincronización de Operaciones y Caja
Cualquier cambio de estado en un pedido que involucre fondos (seña en aprobación o saldo en entrega) DEBE actualizar en tiempo real el saldo y los movimientos del widget de caja.
