# Technical Circuit: dashboard

> **Living Technical Memory: How work runs and where execution flows.**

**Last Updated:** 2026-09-16 · **Changes that shaped this:** `split-screen-dashboard`

---

## Entry Points

| Entry Point | Trigger Mechanism | File:Line |
|---|---|---|
| Split Dashboard View | React Route `/` | `app/frontend/src/features/dashboard/SplitDashboardView.jsx` |
| Widget de Caja Compacto | React Component | `app/frontend/src/features/cashbox/CashboxCompactWidget.jsx` |
| Tablero Operativo | React Component | `app/frontend/src/features/orders/OrderBoard.jsx` |

---

## Execution Path & Synchronization

```
SplitDashboardView
  ├── OrderBoard (Panel Izquierdo - col-12 xl:col-8)
  │     ├── loadOrders() → GET /api/orders
  │     ├── transitionOrder() (Aprobar con seña / Entregar con saldo)
  │     └── onOrderUpdated() callback
  └── CashboxCompactWidget (Panel Derecho - col-12 xl:col-4)
        ├── loadData()
        │     ├── GET /api/cashbox/summary
        │     ├── GET /api/cashbox/movements?limit=8
        │     ├── GET /api/cashbox/categories/income
        │     └── GET /api/cashbox/categories/expense
        ├── Quick Action Dialogs (+Ingreso / -Egreso)
        └── Triggered by order changes to re-fetch balance in real time
```

---

## File Map

| File | Responsibility |
|---|---|
| `app/frontend/src/features/dashboard/SplitDashboardView.jsx` | Contenedor principal responsive split-screen con sincronización de eventos |
| `app/frontend/src/features/cashbox/CashboxCompactWidget.jsx` | Widget financiero lateral: saldo, métricas compactas, botones de acción y últimos movimientos |
| `app/frontend/src/features/orders/OrderBoard.jsx` | Tablero Kanban operativo con cotizador integrado y transiciones de estado |
| `app/frontend/src/App.js` | Enrutamiento de la raíz `/` hacia el dashboard integrado |
