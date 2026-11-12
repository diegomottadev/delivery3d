# Technical Circuit: settings

> **Living Technical Memory: How settings and printers work internally.**
> Created by change: `workshop-settings-and-printers`.

**Last Updated:** 2026-09-15 · **Changes that shaped this:** `workshop-settings-and-printers`

---

## Entry Points

| Entry Point | Trigger Mechanism | File:Line |
|---|---|---|
| `GET /api/settings` | HTTP GET (Obtener configuración del taller) | `backend/app/settings/routes.py:30` |
| `PUT /api/settings` | HTTP PUT (Actualizar configuración del taller) | `backend/app/settings/routes.py:37` |
| `GET /api/printers` | HTTP GET (Listar impresoras) | `backend/app/printers/routes.py:11` |
| `POST /api/printers` | HTTP POST (Crear impresora) | `backend/app/printers/routes.py:23` |
| `PUT /api/printers/<id>` | HTTP PUT (Actualizar impresora) | `backend/app/printers/routes.py:46` |

---

## Execution Path

### 1. Settings Flow
```
GET /api/settings
  → settings/routes.py::get_settings_route()
      → get_or_create_settings() [Crea id=1 con defaults si no existe]
      → jsonify(settings.to_dict()), 200

PUT /api/settings
  → settings/routes.py::update_settings_route()
      → Validar que numéricos sean >= 0 (o multiplier >= 1)
      → Validar existencia de default_printer_id si fue provisto
      → Asignar a WorkshopSettings y db.session.commit()
      → jsonify(settings.to_dict()), 200
```

### 2. Printers Flow
```
POST /api/printers
  → printers/routes.py::create_printer_route()
      → Validar name obligatorio y unicidad
      → Validar power_watts > 0 y cost_per_hour >= 0
      → db.session.add(Printer(...)) y commit
      → jsonify(printer.to_dict()), 201
```

---

## File Map

| File | Responsibility |
|---|---|
| `backend/app/settings/models.py` | Modelo `WorkshopSettings` con check constraints (1FN-4FN) |
| `backend/app/settings/routes.py` | Blueprint `settings_bp` con validaciones de entrada |
| `backend/app/printers/models.py` | Modelo `Printer` con check constraints y unicidad |
| `backend/app/printers/routes.py` | Blueprint `printers_bp` con CRUD de impresoras |
| `frontend/src/features/settings/WorkshopSettingsView.jsx` | Vista visual de gestión de constantes y tabla de impresoras |
| `frontend/src/features/orders/ordersApi.js` | Clientes Axios para `settings` y `printers` |
| `backend/migrations/versions/b7189c4d92ef_add_printers_and_workshop_settings.py` | Migración inicial de tablas |
| `backend/migrations/versions/c83921af7b4e_add_labor_rate_and_time.py` | Migración de adición de tarifa horaria y tiempo en minutos |
