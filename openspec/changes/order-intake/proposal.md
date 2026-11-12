# Proposal: order-intake

- **Domain:** `orders` (folder in `openspec/specs/`)
- **Reference Ticket / Issue:** n/a — derived from `Project.md` §3 "Recepción y Alta Manual"

## Executive Summary
Introduce el alta manual de pedidos (`Order` + `OrderStatusHistory`) para que el taller reemplace las notas informales de WhatsApp/Instagram por un registro central y trazable.

## Why
Hoy el taller recibe prospectos de impresión 3D por WhatsApp e Instagram DM y los registra en notas informales, memoria o chats dispersos. Esto provoca pérdida de datos de clientes, pedidos olvidados y ninguna trazabilidad sobre quién dio de alta un pedido y cuándo. Si no se hace nada, cada nuevo prospecto sigue dependiendo de la memoria del operador, sin registro central ni histórico.

## What Changes
Se introduce la entidad `Order` (Pedido) y el alta manual de un prospecto/pedido con sus datos básicos. Todo pedido nace en el estado `Nuevo / Por cotizar`. Se agrega también el mecanismo base de historial de estados (`OrderStatusHistory`) que será reutilizado por los cambios posteriores (`quote-calculation`, `order-lifecycle`) para registrar cada transición.

## Capabilities
- **New capabilities:**
  - El operador puede dar de alta manualmente un prospecto/pedido con: nombre/apodo del cliente, contacto (WhatsApp/Instagram u otro medio), descripción de la pieza, y enlace o archivo de referencia.
  - El pedido queda creado en estado `Nuevo / Por cotizar`.
  - Queda registrado quién y cuándo se creó el pedido (trazabilidad de alta), sentando la base del historial de estados que reutilizarán los siguientes changes del dominio `orders`.
  - El operador puede listar y consultar los pedidos existentes con sus datos básicos y estado actual.
- **Modified capabilities:** Ninguna — este change es la base fundacional del dominio (greenfield).
- **Removed capabilities:** Ninguna.

## Out of Scope
- Cálculo de cotización (costo de producción, precio de venta sugerido) — corresponde a `quote-calculation`.
- Transiciones de estado posteriores a `Nuevo / Por cotizar` (Presupuestado, Aprobado/En cola, Imprimiendo, Listo, Entregado/Cobrado) — corresponden a `quote-calculation` y `order-lifecycle`.
- Registro o contabilización de movimientos de caja — corresponde al dominio `cashbox`.
- Automatización o integración directa con WhatsApp/Instagram (bots, ingestión automática de mensajes); el alta es manual.
- Autenticación/autorización de usuarios — corresponde al dominio `auth` (se asume, para este change, un único operador autenticado ya existente).
