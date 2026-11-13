# Decisiones

Decisiones vigentes y reemplazadas. Las de diseño de un cambio viven en su `openspec/changes/<cambio>/design.md`; acá va la línea con el porqué y el link.

- 2026-11-12 · Los agentes que escriben código trabajan en worktrees (`.worktrees/<rama>`) · por qué: el contenedor del backend monta `./backend` en vivo y un cambio a medias rompe la app que se está usando · ref: [informe](../../../docs/informes/2026-11-12-informe-sesion.md)
- 2026-11-12 · Secretos solo en `backend/.env`, con lectura bloqueada para Claude en `.claude/settings.json` · por qué: había credenciales en el código y un token de admin en el frontend · ref: [informe](../../../docs/informes/2026-11-12-informe-sesion.md)
- 2026-11-12 · Skills solo con lo que el código no muestra (decisiones del negocio, trampas de MySQL, formatos) · por qué: en las evaluaciones, un agente sin skill rindió casi igual porque el proyecto ya enseña sus reglas · ref: [informe](../../../docs/informes/2026-11-12-informe-sesion.md)
- 2026-11-12 · Dos agentes en paralelo solo para cambios backend + frontend, con contrato de API primero · por qué: cada agente cuesta ~100k tokens por ronda y sin contrato divergen los nombres de endpoints · ref: [informe](../../../docs/informes/2026-11-12-informe-sesion.md)
- 2026-11-12 · Bitácora en `.claude/bitacora/` del checkout principal, con prompts fuera de git · por qué: una sola historia para todos los worktrees y el repo es público · ref: [2026-11-12](../2026-11-12.md)
- 2026-11-13 · Impacto de bajas y SELF_LOCKOUT del RBAC calculados con una sola simulación en memoria · por qué: el diálogo coincide con lo que hace el backend y un 409 no deja cambios a medias · ref: [2026-11-13](../2026-11-13.md)
- 2026-11-13 · Selects nativos en lugar del `Dropdown` de PrimeReact en Seguridad · por qué: el `Dropdown` no se puede testear en jsdom · ref: [2026-11-13](../2026-11-13.md)
- 2026-11-13 · Sin skills externos en `.agents/skills`; los skills del proyecto viven solo en `.claude/skills` · por qué: los enlaces al plugin estaban rotos y Claude Code no lee esa carpeta · ref: [2026-11-13](../2026-11-13.md)
- 2026-11-13 · Todo cambio de esquema toca modelo y migración con los mismos nombres y se verifica con `flask db check` + `tools.schema_check` (también en CI) · por qué: los tests usan create_all y no detectan una migración faltante · ref: [2026-11-13](../2026-11-13.md)
