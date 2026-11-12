# Living Specification: settings

> **The source of truth for what the `settings` domain does right now.**
> Every requirement is written in declarative business language.
> Created by change: `workshop-settings-and-printers`.

## Purpose
Centralizar y normalizar la administración de parámetros operativos fijos del taller (costo de electricidad kWh, merma/purga de filamento, tarifas horarias y tiempos estándar de mano de obra, multiplicador de ganancia) y el catálogo de impresoras 3D con sus especificaciones de potencia y costo de amortización por hora.

---

## Active Requirements

### Requirement: Global Workshop Defaults Management
El sistema DEBE permitir a los operadores autenticados consultar (`GET /api/settings`) y modificar (`PUT /api/settings`) las constantes predeterminadas del taller.
- Entidad: `workshop_settings`.
- Parámetros:
  - `kwh_cost`: Costo monetario por kilovatio-hora de electricidad (default $278.00, `>= 0`).
  - `waste_purge_pct`: Porcentaje de pérdida por merma y purga de filamento (default 10.00%, `>= 0`).
  - `labor_cost_per_hour`: Tarifa horaria del operador (default $650.00, `>= 0`).
  - `default_labor_time_minutes`: Tiempo estándar estimado de preparación por orden (default 15 min, `>= 0`).
  - `profit_multiplier`: Multiplicador sugerido de venta (default 2.00, `>= 1`).
  - `currency_code`: Código ISO de 3 letras de la moneda del taller (default `'ARS'`, longitud 1 a 3 caracteres).
  - `currency_symbol`: Símbolo de denominación monetaria (default `'AR$'`, longitud 1 a 10 caracteres).
  - `default_printer_id`: Referencia opcional a una impresora del catálogo (`printers.id`).
- Todo intento de enviar valores negativos o formatos inválidos debe ser rechazado con código 422.

### Requirement: Workshop 3D Printer Catalog
El sistema DEBE permitir administrar el inventario de impresoras 3D disponibles en el taller.
- Entidad: `printers`.
- Atributos:
  - `id`: Clave primaria atómica entera autoincremental.
  - `name`: Nombre único identificatorio (ej. "Bambu Lab A1").
  - `model`: Modelo de la máquina.
  - `power_watts`: Consumo de potencia promedio en Watts (`> 0`).
  - `cost_per_hour`: Costo de amortización, repuestos y desgaste por hora de impresión (`>= 0`).
  - `is_active`: Booleano para activar/desactivar impresoras sin borrar historial.
- Endpoints:
  - `GET /api/printers`: Listado de impresoras (filtro opcional `?all=true`).
  - `POST /api/printers`: Registro de nueva impresora (valida nombre único y valores positivos).
  - `PUT /api/printers/<id>`: Actualización de especificaciones de una impresora existente.
