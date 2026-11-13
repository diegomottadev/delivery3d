---
name: bitacora-proyecto
description: Registra en .claude/bitacora/ la bitácora por fecha de Delivery3D (avances, decisiones justificadas, descartes, correcciones, regresiones) y mantiene un resumen corto. Usar al cerrar una tarea, antes de un commit, cuando el hook Stop lo pide o cuando se pida registrar.
---

# Bitácora de Delivery3D

Historial por fecha de lo que se trabaja en el proyecto, con el porqué de cada decisión, y un resumen corto que funciona como memoria para las próximas sesiones. Complementa a OpenSpec, no lo reemplaza.

## Dónde escribir

La bitácora vive **siempre en el checkout principal**, también cuando la sesión corre en `.worktrees/<rama>`:

```bash
BITACORA="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/.claude/bitacora"
```

Nunca crear ni editar `.claude/bitacora/` dentro de un worktree: quedaría una copia por rama y conflictos al hacer merge.

```
.claude/bitacora/
├── AAAA-MM-DD.md          # entradas del día (las escribe este skill)
├── prompts/AAAA-MM-DD.md  # prompts textuales (hook UserPromptSubmit, fuera de git, no tocar)
└── resumen/
    ├── resumen.md         # estado actual, CORTO: se inyecta al iniciar cada sesión
    ├── decisiones.md      # decisiones vigentes y reemplazadas, con justificación
    ├── descartado.md      # enfoques que fallaron o se rechazaron, y por qué
    ├── regresiones.md     # síntoma, causa, fix, prevención, veces
    └── indice.md          # una línea por día
```

Fechas y horas en la zona local (`date +%F`, `date +%H:%M`).

## Cuándo usarlo

- **Al cerrar una tarea o una parte con sentido propio** con cambios reales (código, migraciones Alembic, config, specs). Registrar durante la sesión, no al final.
- **Antes de un commit**, y al hacer `sync` o `archive` de un cambio OpenSpec.
- **Cuando el hook Stop avisa** que hay cambios sin registrar y la tarea está cerrada. Si está a medias, no registrar.
- **Cuando el usuario lo pide**: "registrá", "anotalo en la bitácora", "/bitacora-proyecto".

No registrar charlas sin cambios, salvo que salga una decisión.

## Entrada del día

Agregar al final de `$BITACORA/AAAA-MM-DD.md` (si es nuevo, empezar con `# Bitácora AAAA-MM-DD`). Omitir secciones vacías.

```markdown
## HH:MM · <título corto>

**Rama / worktree**: <main | feat/rbac en .worktrees/rbac>
**Change OpenSpec**: [<nombre>](../../openspec/changes/<nombre>/) · <etapa o tarea>  (si aplica)
**Prompts**: [HH:MM, HH:MM](prompts/AAAA-MM-DD.md) · <pedido del usuario en una línea>
**Objetivo**: <qué se buscaba>

**Qué se hizo**
- <cambio concreto> (`app/backend/app/...`, `app/frontend/src/...`)

**Decisiones**
- <decisión> · por qué: <motivo> · alternativa descartada: <cuál y por qué>

**Descartado / intentos fallidos**
- <qué se probó> · por qué no sirvió: <error o motivo concreto>

**Correcciones del usuario**
- <qué marcó como mal> → <cómo se corrigió>

**Regresiones**
- <síntoma> · causa: <causa raíz> · fix: <solución> · prevención: <test o chequeo>

**Verificación**: <comandos corridos y resultado>
**Requiere acción del usuario**: <crear archivo, reiniciar contenedor, correr migración> (si aplica)
**Pendientes**: <lo que quedó abierto>
**Commit**: <hash corto, si hay>
```

### Verificación en este proyecto

Citar lo que se corrió realmente:

- Backend: `cd app/backend && PYTHONPATH=. .venv/bin/pytest -q` y `.venv/bin/ruff check app/ tests/ seeds/`
- Migraciones: `PYTHONPATH=. .venv/bin/flask db upgrade` (aclarar si se aplicó en la base del contenedor)
- Frontend: `cd app/frontend && npm test -- --watchAll=false` y, si aplica, `npm run build`

### Relación con OpenSpec

- Las decisiones de diseño de un cambio van en `openspec/changes/<cambio>/design.md`. La bitácora pone una línea con el porqué y el link, sin copiar el diseño.
- Las decisiones que no tienen un cambio OpenSpec (tooling, workflow de agentes, entorno, Docker) viven completas en la bitácora.
- Si una decisión contradice una spec aprobada en `openspec/specs/`, frenar y preguntar antes de registrarla como vigente.

## Actualizar resumen/

Después de cada entrada, tocar solo lo que cambió:

- **indice.md**: `- [AAAA-MM-DD](../AAAA-MM-DD.md): <temas>`. Una línea por día.
- **decisiones.md**: `- AAAA-MM-DD · <decisión> · por qué: <motivo> · ref: <link>`. Si una reemplaza a otra, tachar la vieja (`~~...~~ reemplazada AAAA-MM-DD`), nunca borrarla.
- **descartado.md**: `- AAAA-MM-DD · <enfoque> · por qué no: <motivo>`. Sirve para no volver a proponer lo mismo.
- **regresiones.md**: una entrada por regresión con fecha, síntoma, causa, fix, prevención y `veces: N`. Si se repite (N ≥ 2), proponer convertir la prevención en algo ejecutable: un test en `app/backend/tests/`, un chequeo en CI (`.github/workflows/`) o un hook. Una vez hecho, anotarlo.
- **resumen.md**: reescribirlo entero (no acumular). Se inyecta en cada sesión: **máximo ~40 líneas o 2500 caracteres**. Secciones:
  - Qué es y stack (2-3 líneas)
  - Estado actual (fases del scope, cambios OpenSpec en curso, ramas abiertas)
  - Reglas aprendidas (las más importantes, con "no hacer X porque Y")
  - Zonas frágiles (con link a regresiones.md)
  - Pendientes abiertos (separar los del usuario)
  - Últimos 3 avances (una línea cada uno, con link)

## Reglas

- **Secretos**: nunca escribir valores de `app/backend/.env` (credenciales de MySQL, `JWT_SECRET_KEY`, `SEED_OPERATOR_PASSWORD`), tokens ni datos de clientes. Usar `[REDACTADO]`. El repo es público.
- **Concreto**: rutas reales, comandos, mensajes de error, nombres de tests.
- **No inventar justificaciones**: si el motivo no quedó claro, poner "motivo no explicitado" o preguntar.
- **No reescribir el pasado**: las entradas de días anteriores no se editan. Las correcciones van en una entrada nueva que las referencie.
- **Al terminar**, avisar en una línea: "Registrado en la bitácora (AAAA-MM-DD HH:MM)".
