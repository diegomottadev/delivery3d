# Change Proposal: split-screen-dashboard

## 1. Context & Motivation
Actualmente en Delivery3D el operador cuenta con el tablero Kanban de pedidos en la raíz (`/`) y la vista financiera de caja diaria en `/cashbox`. Para verificar saldos, registrar cobros manuales o egresos menores (como compra de cinta, spray fijador o insumos), el usuario debe navegar entre dos páginas distintas perdiendo el contexto visual del taller.

El documento [Project.md §5](file:///home/diegomotta/Documentos/Personal%20Develops/Delivery3D/Project.md#L45-L54) define explícitamente el **Diseño de Interfaz (Split-Screen Dashboard)**:
- **Panel Izquierdo:** Tablero operativo de pedidos en producción.
- **Panel Derecho:** Módulo financiero de caja en tiempo real con saldo, accesos rápidos a `+ Registrar Ingreso` y `- Registrar Egreso`, y listado cronológico de últimos movimientos.

## 2. Goals
1. **Vista Unificada Split-Screen (`/`):** Combinar el panel de producción a la izquierda con el panel financiero a la derecha utilizando un layout responsive de PrimeFlex.
2. **Widget Financiero Lateral (`CashboxCompactWidget`):** Tarjetas con saldo actual y balance, botones para registrar ingresos/egresos rápidos con categorías dinámicas y tabla compacta de últimos movimientos.
3. **Sincronización Bidireccional de Eventos:** Cuando un pedido se aprueba con seña o se entrega con cobro de saldo, el widget de caja se actualiza automáticamente sin recargar la página.
4. **Modo Expandible / Colapsable:** Permitir al operador maximizar el tablero a ancho completo o mantener la vista dividida según su preferencia de pantalla.

## 3. Non-Goals
- Modificar el esquema de base de datos (las tablas de pedidos, cotizaciones y caja ya están 100% normalizadas y disponibles).
- Reemplazar la pantalla completa `/cashbox` (esta continúa existiendo para consultas históricas con paginación extendida y filtros avanzados).
