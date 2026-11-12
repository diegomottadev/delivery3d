---
name: owasp-security
description: Usar al escribir o revisar endpoints (blueprints Flask), servicios, modelos SQLAlchemy, formularios React/PrimeReact, autenticación JWT, subida de archivos, dependencias (requirements.txt / package.json) o configuración (docker-compose, .env, Dockerfile). También cuando se pida "revisión de seguridad", "¿es seguro?" u "OWASP".
---

# OWASP Top 10:2025 — Delivery3D

Skill para **escribir** y **revisar** código seguro en Delivery3D según el OWASP Top 10:2025.

## Contexto del proyecto (dónde mirar)

| Capa | Ubicación | Notas de seguridad |
|---|---|---|
| App factory / config | `backend/app/__init__.py`, `backend/app/config.py` | Secretos solo por entorno (`require_env`), headers en `after_request` |
| AuthN / AuthZ | `backend/app/auth/security.py` | `login_required` (JWT HS256, `g.current_user`), `roles_required(*roles)` (RBAC) |
| Login | `backend/app/auth/routes.py`, `services.py` | Mensaje genérico, `check_password` con hash salado |
| Endpoints | `backend/app/<módulo>/routes.py` | Blueprints `url_prefix="/api/<módulo>"`; toda ruta lleva `@login_required` |
| Validación | `backend/app/orders/schemas.py`, `orders/pricing.py` | Lista blanca de campos, `Decimal` con `ROUND_HALF_UP` |
| Lógica / transacciones | `backend/app/<módulo>/services.py` | Commit/rollback explícito, UPDATE condicional contra carreras |
| Estados | `backend/app/orders/state_machine.py` | Transiciones válidas = regla de negocio de seguridad |
| Dinero | `backend/app/money.py`, `cashbox/` | Nunca `float`; movimientos de caja son registro contable |
| Frontend API | `frontend/src/features/*/…Api.js`, `setupProxy.js` | Axios + proxy `/api` → backend; token JWT en `localStorage` |
| Infra | `docker-compose.yml`, `backend/Dockerfile`, `backend/.env.example` | `.env` NUNCA se lee ni se versiona (ver `.claude/settings.json`) |

**Regla de oro:** no leer, imprimir ni pedir el contenido de `backend/.env`, variables de entorno (`printenv`, `docker inspect`) ni secretos. Para revisar config usar `backend/.env.example` y el código que la consume.

## Checklist

El checklist completo por categoría (A01–A10) con controles concretos para Flask/SQLAlchemy/React está en
**[references/checklist.md](references/checklist.md)**. Leerlo antes de cualquier revisión o al escribir código sensible.

Resumen de lo más crítico en este repo:

- **A01** — Toda ruta con `@login_required`; operaciones destructivas/financieras con `@roles_required("admin")`. Acceso a recursos por ID: validar existencia y, si aplica, pertenencia. Nunca `Model(**request.json)`.
- **A02** — Sin `--debug` ni `FLASK_DEBUG=1` fuera de dev; headers de seguridad; sin CORS abierto.
- **A03** — `pip-audit -r backend/requirements.txt`, `npm audit` en `frontend/`; versiones pineadas y lockfile commiteado.
- **A04** — Passwords solo con hash (`set_password`/`check_password`); `JWT_SECRET_KEY` fuerte desde entorno; HTTPS en prod.
- **A05** — Solo ORM o `text()` con parámetros bind; nada de f-strings en SQL; sin `dangerouslySetInnerHTML`; sin `subprocess(shell=True)`.
- **A06** — Rate limit en `/api/auth/login`; máquina de estados como única vía de cambio de estado; montos validados con `Decimal`.
- **A07** — `jwt.decode` con `algorithms=[...]`, `issuer` y `require`; expiración corta; mensajes de login idénticos.
- **A08** — Sin `pickle`/`yaml.load` sobre datos externos; migraciones Alembic revisadas; webhooks con HMAC.
- **A09** — Loguear login fallido, borrados y movimientos de caja con `user_id`; NUNCA passwords, tokens, `DATABASE_URL`.
- **A10** — No devolver `str(exc)` en 500; `rollback()` ante excepción; fail-closed en auth.

## Modo 1 — Escribir código nuevo (por defecto, sin que lo pidan)

Al crear o modificar endpoints, servicios, modelos, formularios o config, aplicar el checklist **siempre**:

1. **Ruta nueva** → `@login_required` como mínimo. Si borra, toca caja, settings o usuarios → `@roles_required("admin")`.
   ```python
   @orders_bp.delete("/<int:order_id>")
   @roles_required("admin")          # no solo login_required
   def delete_order_route(order_id: int):
   ```
2. **Input** → `request.get_json(silent=True) or {}` + validador con lista blanca de campos (patrón `validate_order_intake`). Verificar tipos (`isinstance(x, dict)`) antes de usar.
3. **SQL** → ORM o `db.text("... WHERE id = :id").bindparams(id=x)`. Nunca concatenar.
4. **Dinero** → `Decimal` + `quantize(Decimal("0.01"), ROUND_HALF_UP)`; rechazar negativos/NaN.
5. **Errores** → respuestas genéricas (`{"error": "..."}`), códigos correctos (401/403/404/409/422), sin stack trace ni `str(exc)` de excepciones no controladas.
6. **Escrituras** → `try: ... commit() except: rollback(); raise`.
7. **Auditoría** → acciones destructivas o financieras dejan rastro (`OrderStatusHistory`, `CashMovement.user_id`, o log).
8. **Frontend** → nunca `dangerouslySetInnerHTML` con datos del backend; no guardar más que el token; no loguear el token en consola.
9. **Secretos** → solo `require_env("NOMBRE")` + placeholder en `.env.example`. Nunca un default con valor real.
10. **Tests** → por cada control de acceso, un test que verifique 401 (sin token) y 403 (rol incorrecto). Patrón en `backend/tests/conftest.py` (`auth_headers`).

Si un requisito del usuario contradice un control (ej. "dejá que cualquiera borre"), implementarlo pero **avisar el riesgo explícitamente** en la respuesta.

## Modo 2 — Revisión de seguridad

### Flujo

1. **Delimitar alcance**: archivo(s), módulo o diff. Si no se indica, preguntar o usar el diff actual.
2. **Mapear la superficie**: para cada ruta del blueprint anotar método, path, decorador de auth, input que recibe, servicio que llama.
3. **Recorrer categorías en orden A01 → A10, una por vez**:
   - Leer la sección correspondiente de `references/checklist.md`.
   - Seguir el flujo route → schema → service → model (no revisar solo el controlador).
   - Por cada hallazgo: `archivo:línea`, escenario concreto de explotación (request de ejemplo), fix propuesto (código).
   - Si no hay hallazgos, declararlo: "A0X: sin hallazgos (verificado: …)".
   - **No pasar a la siguiente categoría hasta cerrar la actual.** En revisiones interactivas, presentar la categoría y esperar confirmación del usuario; en revisiones de una sola pasada, cerrar cada una antes de abrir la siguiente.
4. **Verificar** cada hallazgo antes de reportarlo: leer el código real, no suponer. Descartar falsos positivos (ej. `int:` en la ruta ya impide inyección en el ID).
5. **Consolidar** en la tabla de salida, ordenada por severidad.
6. **No aplicar fixes** salvo que el usuario lo pida. Si los pide, seguir TDD (test rojo primero) según `CLAUDE.md`.

### Severidad

- **Alta**: explotable por un usuario autenticado cualquiera o anónimo; pérdida/alteración de datos financieros; bypass de auth; RCE; fuga de secretos.
- **Media**: requiere condición adicional (rol, configuración de dev expuesta, carrera); impacto acotado; falta de auditoría en operaciones críticas.
- **Baja**: hardening, defensa en profundidad, fuga de información menor.

### Formato de salida (fijo)

```markdown
## Revisión OWASP — <alcance>

| # | Categoría | Severidad | Archivo:línea | Problema | Fix |
|---|---|---|---|---|---|
| 1 | A01 Broken Access Control | Alta | `backend/app/x/routes.py:42` | … | … |

### Detalle
**#1 — <título corto>**
- Escenario: `curl -X DELETE /api/... -H "Authorization: Bearer <token operador>"` → …
- Fix:
  ```python
  ...
  ```

### Categorías sin hallazgos
A05, A08 — verificado: …
```

Reglas del formato: rutas relativas al repo, una fila por hallazgo, severidad en {Alta, Media, Baja}, fix accionable (no "mejorar la seguridad").

## Fuera de alcance

- Si la app incorpora LLMs (prompts, agentes, RAG), revisar además con el **OWASP Top 10 for LLM Applications** (prompt injection, output handling, excessive agency, etc.). Este skill no lo cubre.
- Pentesting activo contra entornos que no sean locales, escaneo de infraestructura y revisión de la configuración de MySQL/servidor quedan fuera; mencionarlos como recomendación si aparecen.
