# Implementation Tasks: split-screen-dashboard

- [x] 1. Componente Widget Financiero Lateral (`CashboxCompactWidget.jsx`)
  - [x] 1.1 Crear `frontend/src/features/cashbox/CashboxCompactWidget.jsx` con métricas clave (Saldo, Ingresos, Egresos).
  - [x] 1.2 Incorporar botones de acción rápida (+Ingreso / -Egreso) con modales y categorías dinámicas.
  - [x] 1.3 Incorporar tabla compacta de últimos movimientos cronológicos (límite 8).
  - [x] 1.4 Exponer método `refresh()` mediante `forwardRef` e `useImperativeHandle`.

- [x] 2. Soporte de Sincronización en `OrderBoard.jsx`
  - [x] 2.1 Agregar prop opcional `onOrderStateChanged` en `OrderBoard.jsx`.
  - [x] 2.2 Invocar el callback tras `handleApprove` y `confirmDeliver`.

- [x] 3. Vista Integrada Split-Screen (`SplitDashboardView.jsx`) y Navegación
  - [x] 3.1 Crear `frontend/src/features/dashboard/SplitDashboardView.jsx` con layout responsive `col-12 xl:col-8` y `col-12 xl:col-4`.
  - [x] 3.2 Añadir selector de visualización (Split-Screen / Full Kanban).
  - [x] 3.3 Conectar la sincronización de eventos entre `OrderBoard` y `CashboxCompactWidget`.
  - [x] 3.4 Actualizar la ruta `/` en `frontend/src/App.js` para renderizar `SplitDashboardView`.
  - [x] 3.5 Actualizar breadcrumb y menú en `App.js`.

- [x] 4. Pruebas Unitarias y Verificación
  - [x] 4.1 Escribir `CashboxCompactWidget.test.js`.
  - [x] 4.2 Escribir `SplitDashboardView.test.js`.
  - [x] 4.3 Ejecutar suite completa de tests de frontend y verificar 100% verde — **54 passed** (13 suites).
  - [x] 4.4 Verificar compilación limpia (`npm run build`) — Compiled successfully.

- [x] 5. Sincronización OpenSpec
  - [x] 5.1 Actualizar `openspec/project.md`.
