# Living Specification: dashboard

> **The source of truth for what this domain does right now.**
> Every requirement is written in declarative business language.

## Purpose
Proveer un panel de control unificado y de pantalla dividida (Split-Screen Dashboard) que combine en una única vista operativa el flujo de producción de pedidos de impresión 3D (Bambu Lab A1) y el control financiero de caja diaria en tiempo real, maximizando la productividad del operador y la sincronización entre ventas y finanzas.

---

## Active Requirements

### Requirement: REQ-DASH-01 Tablero Split-Screen Integrado (Project.md §5)
El sistema DEBE presentar en la pantalla principal (`/`) una disposición de pantalla dividida responsive compuesta por:
1. **Panel Izquierdo (Tablero Operativo de Pedidos):**
   - Columnas del flujo de trabajo: `Por Cotizar` (Nuevos), `Presupuestados`, `En Cola / Aprobados`, `Imprimiendo`, `Listos para Retiro`, `Entregados`.
   - Acceso directo a la cotización con parámetros del laminador Bambu Studio.
   - Botón destacado para dar de alta un nuevo pedido.
2. **Panel Derecho (Módulo Financiero de Caja):**
   - Tarjetas de resumen en tiempo real: Saldo disponible, total de ingresos y total de egresos con formato en la moneda configurada del taller.
   - Acciones rápidas con botones `+ Registrar Ingreso` y `- Registrar Egreso` con categorización dinámica.
   - Listado cronológico compacto de los últimos movimientos de caja registrados.

#### Scenarios
```gherkin
Scenario: Carga inicial de la vista split-screen
  GIVEN el usuario accede a la raíz del sistema (/)
  THEN se visualiza a la izquierda el tablero Kanban con sus columnas
  AND se visualiza a la derecha el widget financiero con el saldo actual y los últimos movimientos de caja

Scenario: Sincronización en tiempo real tras cobrar saldo en entrega
  GIVEN un pedido en estado "Listo" con saldo pendiente
  WHEN el operador realiza la entrega con "Cobrar saldo en caja" activo
  THEN el pedido avanza al estado "Entregado" en el panel izquierdo
  AND el panel derecho actualiza de inmediato el saldo disponible y añade el movimiento de ingreso
```

---

### Requirement: REQ-DASH-02 Adaptabilidad y Modo Expandido
El sistema DEBE permitir contraer o expandir el panel financiero lateral mediante un selector de visualización, permitiendo operar tanto en vista dividida (Split-Screen) como en vista de tablero ampliado (Full Kanban), adaptándose a pantallas móviles y escritorios.
