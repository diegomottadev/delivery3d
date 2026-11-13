# project.md — Context for Delivery3D (OpenSpec)

> **Minimal project context required for Spec-Driven Development.**
> This document describes the purpose of the system, main functional domains, and cross-cutting constraints that every spec must follow.

---

## 🏢 What is Delivery3D

Aplicación web para centralizar la gestión de pedidos de impresión 3D y el control financiero de un taller que opera una impresora Bambu Lab A1. Reemplaza notas informales en papel, memoria y chats dispersos (WhatsApp/Instagram DM) por un flujo estructurado con trazabilidad completa, desde la recepción del prospecto hasta la entrega y cobro, incluyendo cotización automática y caja diaria.

- **Stack:** Backend en Python con Flask (API REST modular); Frontend en React sobre la plantilla local `babylon-react-8.0.1`; Persistencia relacional en MySQL vía SQLAlchemy; Autenticación JWT con `bcrypt`/`werkzeug.security` y protección de rutas.
- **Core Entities (esquema normalizado 1FN-4FN/BCNF, ver `app/backend/migrations/schema_design_normalized.sql`):** `users`, `clients`, `materials` (catálogo de filamentos), `orders` (encabezado: `client_id`, `user_id`, `status`), `order_items` (detalle multi-pieza por pedido, `material_id` por ítem — resuelve la dependencia multivaluada de 4FN), `order_quotes` (parámetros de costo del taller, relación con `printers`, `labor_cost_per_hour` y `labor_time_minutes`; `production_cost`/`suggested_sale_price` NO se persisten — se calculan on-read para cumplir 3FN), `order_status_history` (auditoría de transiciones), `printers` (catálogo de impresoras 3D del taller con potencia y amortización), `workshop_settings` (constantes operativas predeterminadas normalizadas del taller, incluyendo moneda `currency_code` y `currency_symbol`), `cash_movements` (movimientos de caja diaria: ingresos por señas y saldos de pedidos, ingresos extraordinarios y egresos operativos, con balance dinámico on-read).
- **Business & Code Language:** Español para dominio de negocio (nombres de estados, mensajes al usuario); código e identificadores técnicos en inglés.

---

## 📦 Spec Domains (Folders in `openspec/specs/`)

| Domain | Scope | Reference Documentation |
|---|---|---|
| `orders` | Alta manual de prospectos (`clients` + `order_items` multi-pieza), cotización (`order_quotes`, cálculo on-read) y ciclo de vida del pedido (`nuevo` → `presupuestado` → `aprobado` → `imprimiendo` → `listo` → `entregado`). Implementado en `app/backend/app/{clients,materials,orders}/`. | Project.md §3, `openspec/changes/{order-intake,quote-calculation,order-lifecycle,workshop-settings-and-printers,weight-three-decimals}/` |
| `settings` | Configuración y valores constantes del taller (`workshop_settings`: costo kWh, merma/purga %, tarifa de mano de obra por hora, tiempo por defecto, margen multiplicador, moneda configurable e impresora predeterminada) y catálogo de impresoras 3D (`printers`: potencia W, amortización $/h). Implementado en `app/backend/app/{settings,printers}/` y `app/frontend/src/features/settings/`. | `openspec/changes/workshop-settings-and-printers/` |
| `cashbox` | Control financiero y caja diaria: registro de ingresos (señas de pedidos, cobro de saldo final en un clic, ingresos extraordinarios), egresos operativos categorizados (filamento, repuestos A1, servicios, embalaje), cálculo dinámico on-read de balance en tiempo real (3FN), moneda configurable en taller (`AR$`, `USD`, `CLP`, etc.) y catálogo normalizado en BD de formas de ingresos y egresos administrable desde UI. Implementado en `app/backend/app/cashbox/` y `app/frontend/src/features/cashbox/`. | Project.md §4, `openspec/specs/cashbox/`, `openspec/changes/{cashbox-management,cashbox-categories-and-settings}/` |
| `dashboard` | Interfaz split-screen en la ruta `/`: tablero operativo de pedidos (`OrderBoard`) a la izquierda, widget financiero compacto de caja (`CashboxCompactWidget`, con saldo, ingresos/egresos rápidos, categorías dinámicas y últimos 8 movimientos) a la derecha, con sincronización de eventos al aprobar/entregar pedidos y toggle Split/Kanban completo. Implementado en `app/frontend/src/features/dashboard/SplitDashboardView.jsx` y `app/frontend/src/features/cashbox/CashboxCompactWidget.jsx`. | Project.md §5, `openspec/changes/split-screen-dashboard/` |
| `auth` | Autenticación basada en JWT, cifrado salteado de contraseñas, control de roles y protección de rutas. Implementado en `app/backend/app/auth/` y `app/frontend/src/features/auth/` aplicando directrices de Neil Madden ("API Security in Action") y mitigación de OWASP API Security Top 10 (BOLA, Broken Auth, BOPLA). | Project.md §2, `openspec/specs/auth/`, `openspec/changes/auth-security-owasp/` |

> 💡 **To add a new domain:** create the directory `openspec/specs/<new-domain>/` with its `spec.md` (the WHAT) and `circuit.md` (the HOW) based on OpenSpec templates.

---

## 🛑 Constraints that EVERY Spec / Design Must Follow

- **Runtime Version:** Python (Flask) 3.12; React 18 sobre la plantilla local `babylon-react-8.0.1` en Node.
- **Persistence Patterns:** SQLAlchemy como ORM sobre MySQL (mismo motor en desarrollo y producción). Toda entidad de negocio (Pedido, Cotización, Movimiento de Caja) debe quedar trazable a su `order_id` cuando aplique.
  - **Entorno de desarrollo:** se usa el contenedor Docker `mysql8` (imagen `mysql:8.0`, puerto host `3306`) ya corriendo localmente. Base de datos: `delivery3d` (charset `utf8mb4`/`utf8mb4_unicode_ci`). Usuario de aplicación: `delivery3d_app` (credenciales locales en `.env`, no versionar). No usar el usuario `root` del contenedor desde la app.
- **Migration Strategy:** Alembic (Flask-Migrate), migraciones incrementales aditivas — ya en uso, ver `app/backend/migrations/versions/`. No se usa `DROP DATABASE`/reset destructivo: cambios de esquema van por `flask db migrate` + `flask db upgrade`.
- **Security & Authorization:** JWT para autenticación; `login_required` (`app/backend/app/auth/security.py`) valida firmas con algoritmo fijado `HS256`, expiración de 24h, claims estándar (`sub`, `iss`, `iat`), resolución de usuario activo en BD asignando `g.current_user_id` y `g.current_user` (mitigación BOLA). Protección de contraseñas con `werkzeug.security` (salteado constante en tiempo), control de roles `@roles_required`, whitelisting estricto de campos (mitigación BOPLA / Mass Assignment) y cabeceras de seguridad HTTP (`nosniff`, `DENY`). En frontend, `AuthContext` gestiona el ciclo de vida de la sesión con interceptores Axios para 401 y `ProtectedRoute`.
- **High-Risk Modules:** `app/backend/app/orders/pricing.py` (cálculo de costo/precio de venta — impacto financiero directo, 100% cobertura de tests exigida), `app/backend/app/orders/state_machine.py` (transiciones de estado — un error rompe la trazabilidad) y `app/backend/app/cashbox/services.py` (cálculo de balance en tiempo real, cobro de señas y liquidación de saldos de pedidos).
- **Normalización:** el esquema sigue 1FN-4FN/BCNF estrictamente — ver justificación completa en el mensaje de diseño original y `app/backend/migrations/schema_design_normalized.sql`. En particular: `order_items` desacopla piezas de materiales (resuelve dependencia multivaluada), y `production_cost`/`suggested_sale_price` NUNCA son columnas persistidas (se derivan de `order_items` + `order_quotes` vía `app/orders/pricing.py::compute_quote`, invocado on-read).

---

## 🧭 Source of Truth

- **What the system does today:** `openspec/specs/<domain>/spec.md` (living specifications).
- **How it runs internally:** `openspec/specs/<domain>/circuit.md` (living technical flow).
- **What is currently being changed:** `openspec/changes/<change-name>/`.
- **History of completed changes:** `openspec/archive/`.
