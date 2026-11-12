# Technical Design: split-screen-dashboard

## 1. UI Architecture & Component Hierarchy

```
App.js (Route: "/")
  └── SplitDashboardView.jsx
        ├── Header con Métricas Clave y Toggle de Visualización (Split / Full)
        ├── Left Column (col-12 xl:col-8 o col-12)
        │     └── OrderBoard.jsx (con prop onOrderUpdated)
        │           ├── Columnas Kanban (Nuevos → Entregados)
        │           ├── IntakeModal (+ Nuevo Pedido)
        │           ├── QuoteModal (Calculadora de Slicer Bambu Studio)
        │           └── DeliverModal (con cobro de saldo en caja)
        └── Right Column (col-12 xl:col-4 o hidden si está colapsado)
              └── CashboxCompactWidget.jsx (con ref para refresh)
                    ├── Saldo en Caja (card verde destacada)
                    ├── Ingresos / Egresos / Movimientos (cards secundarias)
                    ├── Botones de Acción (+Ingreso / -Egreso)
                    ├── Tabla de Últimos Movimientos (últimos 8 registros)
                    ├── Enlace a "Ver Caja Completa" (/cashbox)
                    └── Modales de Registro con Dropdown de Categorías Dinámicas
```

## 2. Event Synchronization
- `OrderBoard` recibe una prop opcional `onOrderStateChanged`.
- Al confirmar una seña (`approveOrder`) o cobrar el saldo en la entrega (`deliverOrder`), se invoca `onOrderStateChanged()`.
- `SplitDashboardView` ejecuta `cashboxRef.current?.refresh()`, provocando la actualización inmediata del saldo y de la lista de movimientos sin intervención manual del usuario.

## 3. Responsiveness
- En pantallas grandes (`xl` $\ge$ 1200px): distribución en dos columnas (`xl:col-8` y `xl:col-4`).
- En tablets y pantallas medianas: distribución apilada (`col-12`).
- Control de vista: botón en la barra superior del dashboard que conmuta entre `split` (predeterminado) y `full` (tablero expandido al 100%).
