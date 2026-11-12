# Proposal: quote-calculation

- **Domain:** `orders` (folder in `openspec/specs/`)
- **Reference Ticket / Issue:** n/a — derived from `Project.md` §3 "Módulo de Cotización Integrado"

## Executive Summary
Agrega el cálculo automático de cotización (costo de producción + precio de venta sugerido) sobre pedidos existentes, reemplazando la calculadora externa manual y disparando la transición `NEW → QUOTED`.

## Why
El taller cotiza cada pieza de forma manual con una calculadora externa (calculadora3d.com.ar), copiando y recalculando variables del laminador y del taller a mano. Esto es lento y propenso a errores de cálculo que afectan directamente la rentabilidad (costos mal cargados, márgenes olvidados). Si no se hace nada, cada cotización sigue dependiendo de un cálculo manual externo desconectado del pedido.

## What Changes
Se agrega el módulo de cotización sobre un pedido ya existente en estado `Nuevo / Por cotizar` (creado por `order-intake`). A partir de variables del laminador (peso final, tiempo de impresión) y variables de costo del taller (filamento, desperdicio, electricidad, amortización, mano de obra, margen), el sistema calcula automáticamente el costo de producción y el precio de venta sugerido. Al informar el valor final al cliente, el pedido transiciona de `Nuevo / Por cotizar` a `Presupuestado`.

## Capabilities
- **New capabilities:**
  - El operador puede cargar, para un pedido existente, las variables del laminador (peso en gramos, tiempo estimado en horas/minutos) y las variables de costo del taller (costo de filamento por kg + % desperdicio/purga, consumo eléctrico, amortización/mantenimiento por hora, mano de obra, margen de ganancia deseado).
  - El sistema calcula automáticamente el costo de producción y el precio de venta final sugerido a partir de esas variables.
  - El operador puede registrar el valor final efectivamente informado al cliente (puede diferir del sugerido).
  - Al registrar el valor informado, el pedido transiciona de `Nuevo / Por cotizar` a `Presupuestado`, quedando esa transición en el historial de estados (`OrderStatusHistory`, introducido por `order-intake`).
- **Modified capabilities:** Ninguna sobre entidades existentes fuera de agregar los campos y la transición descriptos.
- **Removed capabilities:** Ninguna.

## Out of Scope
- Transiciones de estado posteriores a `Presupuestado` (Aprobado/En cola, Imprimiendo, Listo, Entregado/Cobrado) — corresponden a `order-lifecycle`.
- Registro de seña/anticipo o cualquier movimiento de caja — corresponde a `order-lifecycle` (dato del pedido) y `cashbox` (movimiento contable real).
- Catálogo reutilizable de materiales/filamentos como entidad propia — los valores de costo se cargan como variables de la cotización.
- Persistencia de una configuración general de costos del taller (electricidad, amortización, mano de obra) reutilizable entre cotizaciones — en este change los valores se cargan por cotización; una configuración global queda como evolución futura a evaluar.
