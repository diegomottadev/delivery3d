# Proposal: order-lifecycle

- **Domain:** `orders` (folder in `openspec/specs/`)
- **Reference Ticket / Issue:** n/a — derived from `Project.md` §3 "Ciclo de Vida y Estados del Pedido"

## Executive Summary
Agrega las transiciones de estado del ciclo de vida del pedido (`QUOTED→APPROVED→PRINTING→READY→DELIVERED`) con historial completo, para que los operadores tengan visibilidad en tiempo real del estado de producción.

## Why
Una vez presupuestado un pedido (`quote-calculation`), hoy no hay forma estructurada de saber si el cliente lo aprobó, si está en cola de impresión, imprimiéndose, listo para retirar o ya entregado — esa información vive en la memoria del operador o en chats dispersos. Sin esto, no hay visibilidad operativa del estado real de producción de cada pedido.

## What Changes
Se agregan las transiciones de estado restantes del ciclo de vida del pedido: `Presupuestado` → `Aprobado / En cola` → `Imprimiendo` → `Listo` → `Entregado / Cobrado`. Cada transición se registra en el historial de estados (`OrderStatusHistory`, introducido por `order-intake`). Al aprobar un pedido, el operador puede opcionalmente registrar el monto recibido como seña (solo como dato del pedido, sin generar un movimiento de caja).

## Capabilities
- **New capabilities:**
  - El operador puede marcar un pedido `Presupuestado` como `Aprobado / En cola`, registrando opcionalmente un monto de seña/anticipo como dato del pedido.
  - El operador puede avanzar un pedido `Aprobado / En cola` a `Imprimiendo`, `Imprimiendo` a `Listo`, y `Listo` a `Entregado / Cobrado`.
  - Cada transición de estado queda registrada en el historial del pedido (quién y cuándo).
  - El operador puede consultar en cualquier momento el estado actual de un pedido y su historial de transiciones.
- **Modified capabilities:** Ninguna sobre entidades existentes fuera de agregar el campo de seña y las transiciones descriptas.
- **Removed capabilities:** Ninguna.

## Out of Scope
- Registro o contabilización real del movimiento de caja generado por la seña o el pago final — corresponde al dominio `cashbox`.
- Notificaciones automáticas al cliente ante cambios de estado (ej. aviso de "Listo para retiro").
- Reportes o métricas agregadas de tiempos de producción entre pedidos.
- Reglas de reversión de estado (volver de un estado a uno anterior) — a definir como posible change futuro si el negocio lo requiere; este change asume avance secuencial estricto hacia adelante.
