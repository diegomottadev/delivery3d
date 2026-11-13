# Regresiones

## 2026-11-12 · Backend caído al mover secretos a `.env`
- **Síntoma**: el backend en Docker dejó de responder; no se podían borrar pedidos.
- **Causa**: la configuración pasó a leerse de `backend/.env` y ese archivo todavía no existía en la máquina del usuario.
- **Fix**: crear `backend/.env` desde `backend/.env.example` y recrear el contenedor.
- **Prevención**: avisar antes de cualquier cambio que requiera una acción del usuario. Pendiente: que el backend falle al arrancar con un mensaje claro si faltan variables.
- **veces**: 1

## 2026-11-12 · Todos los logins con error 500
- **Síntoma**: login devolvía 500 durante unos minutos.
- **Causa**: un agente agregó columnas al modelo de usuarios trabajando en la misma carpeta que monta el contenedor, con la migración sin aplicar.
- **Fix**: mover el trabajo del agente a `.worktrees/rbac` (rama `feat/rbac`).
- **Prevención**: agentes que escriben código siempre en worktree. Pendiente: chequeo en CI de que no haya cambios de modelo sin migración (`flask db check` o equivalente).
- **veces**: 1

## 2026-11-13 · App sin código tras mover la carpeta del proyecto
- **Síntoma**: Delivery3D y `personal-nginx` corrían con carpetas vacías de root en `~/Documentos/Personal Develops`.
- **Causa**: los proyectos se movieron a `~/Documentos/project develoment` y los contenedores seguían montando la ruta vieja; Docker la recreó vacía.
- **Fix**: devolver las carpetas a `Personal Develops`, `chown` de la carpeta padre, `git worktree repair` y reiniciar los contenedores.
- **Prevención**: si se mueve un proyecto, recrear sus contenedores (`docker compose up -d`) desde la ruta nueva; `Personal Develops` tiene que ser del usuario, no de root.
- **veces**: 1

## 2026-11-13 · CHECK en los modelos que no existían en la base real
- **Síntoma**: la base de desarrollo aceptaba datos que los tests rechazan (6 CHECK faltantes).
- **Causa**: los tests crean el esquema con `db.create_all()`; los CHECK se agregaron al modelo sin migración, y Alembic no compara CHECK.
- **Fix**: migración `e5c1a7d93f20`.
- **Prevención**: paso de CI que migra una base vacía y corre `flask db check` + `tools.schema_check` ([skill mysql-database](../../skills/mysql-database/SKILL.md)).
- **veces**: 1
