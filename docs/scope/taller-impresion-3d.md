# Scope: Plataforma Integral Taller de Impresión 3D

- **Slug:** `taller-impresion-3d`
- **Status:** `active` <!-- draft | active | done -->
- **Created:** 2026-09-18
- **Last Updated:** 2026-09-18

## Idea
Sistema integral de gestión de producción, cotizaciones dinámicas y flujo de caja para un taller de impresión 3D (Bambu Lab A1). Elimina notas informales y mensajes dispersos, garantizando trazabilidad completa desde la recepción del prospecto hasta la entrega del producto y liquidación en caja, con arqueo en tiempo real bajo un esquema normalizado 1FN-4FN/BCNF.

## Build Order
Coarse-grained phases in the order they'll be tackled. A phase is not a ticket — it becomes one or more `/change` (or `/refine`) entries once it's ready to be sliced into atomic work.

| # | Phase | Status | Linked Change(s) |
|---|---|---|---|
| 1 | Alta y recepción de prospectos multi-pieza | `done` | `order-intake`, `weight-three-decimals` |
| 2 | Cotización y cálculo dinámico de costos de producción | `done` | `quote-calculation`, `workshop-settings-and-printers` |
| 3 | Ciclo de vida operativo y transiciones de estado | `done` | `order-lifecycle` |
| 4 | Gestión de caja diaria, señas y saldos | `done` | `cashbox-management`, `cashbox-categories-and-settings` |
| 5 | Seguridad y control de acceso (OWASP Top 10) | `done` | `auth-security-owasp` |
| 6 | Dashboard split-screen unificado | `done` | `split-screen-dashboard` |
| 7 | Eliminación segura de pedidos con preservación de arqueo | `done` | `order-deletion` |
| 8 | Control de stock y consumo de bobinas de filamento | `not-started` | — |
| 9 | Monitoreo de impresora y métricas operativas | `not-started` | — |

## Out of Scope (for now)
- Integración por protocolo directo MQTT / Cloud de Bambu Lab (se operará manualmente desde el tablero de control).
- Tienda e-commerce pública orientada a autoservicio de clientes finales (el sistema es exclusivamente para uso del operador del taller).
- Facturación fiscal electrónica AFIP/ARCA (por ahora el arqueo es de caja interna del taller).

## Open Questions
- ¿El consumo de stock de filamento debe descontarse automáticamente al avanzar el pedido a `imprimiendo` o confirmarse al finalizar en `listo`?

## Change Log
- 2026-09-18: Cambio `order-deletion` auditado por `code-reviewer` (veredicto APPROVED con Depth GA), delta sincronizada en especificaciones vivas y archivado en `openspec/archive/2026-09-18-order-deletion/`. Fase 7 completada.
- 2026-09-18: Scope document inicializado. Se vinculan las fases 1 a 7 ya completadas y se planifican las fases 8 y 9.
