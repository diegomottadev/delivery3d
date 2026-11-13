# Delivery3D · resumen

**Qué es**: gestión de pedidos, cotización y caja para un taller de impresión 3D (Bambu Lab A1). Flask + SQLAlchemy + MySQL 8 / React 18 + PrimeReact. OpenSpec + TDD estricto en dinero, precios y estados.

## Estado actual
- Fases 1 a 7 del scope terminadas (`docs/scope/taller-impresion-3d.md`). Fases 8 (stock de filamento) y 9 (monitoreo) sin empezar.
- RBAC (`openspec/changes/rbac-access-control/`): etapas 1–5 en main. Etapa 6 (33 endpoints `/api/rbac/*` + pantallas Usuarios, Grupos y Roles) en main (`0a71161`).
- Base: migración `e5c1a7d93f20` aplicada; CI valida migraciones desde cero (`flask db check` + `tools.schema_check`). Skill `mysql-database`.
- Proyectos en `~/Documentos/Personal Develops` (ahí montan todos los contenedores).

## Reglas aprendidas
- Antes de cambiar un comportamiento, mirar `openspec/specs/`: lo que parece un bug puede ser una decisión aprobada.
- Los agentes que escriben código trabajan siempre en un worktree, nunca en la carpeta que monta el contenedor.
- No mover carpetas de proyectos sin recrear sus contenedores: Docker recrea la ruta vieja vacía ([regresiones](regresiones.md)).
- Todo cambio que exija una acción del usuario se avisa antes, junto con lo que deja de andar.
- Pedidos o textos pensados para otro stack (FastAPI) se traducen a Flask antes de usarlos.
- Dinero en `Decimal` con `ROUND_HALF_UP` y `DECIMAL(10, 2)`. `InputNumber` de montos con `locale="es-AR"`.

## Zonas frágiles
- Modelos vs migraciones: los tests usan create_all ([regresiones](regresiones.md)).
- Modelo de usuarios y migraciones ([regresiones](regresiones.md)).
- Configuración y secretos del backend: depende de `app/backend/.env` ([regresiones](regresiones.md)).
- Montajes de Docker sobre rutas del host ([regresiones](regresiones.md)).

## Pendientes
- Siguiente: que el usuario pruebe la etapa 6 en la app (crear grupo/rol, asignar, usuario operador).
- Menor RBAC: separar `rbac/services.py` (969 líneas).
- Usuario: ¿el stock de filamento se descuenta al pasar a `imprimiendo` o al llegar a `listo`?

## Últimos avances
- 2026-11-13: base alineada con los modelos (6 CHECK) y skill `mysql-database` ([detalle](../2026-11-13.md)).
- 2026-11-13: RBAC etapa 6 en main, con los arreglos de casillas y breadcrumb ([detalle](../2026-11-13.md)).
- 2026-11-13: repo y contenedores de vuelta en `Personal Develops` ([detalle](../2026-11-13.md)).
