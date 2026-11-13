# Checklist OWASP Top 10:2025 — Flask / SQLAlchemy / React (Delivery3D)

Cada ítem: **qué verificar** → *cómo detectarlo en este repo*.

---

## A01 — Broken Access Control (incluye SSRF)

- [ ] Toda ruta de `app/backend/app/*/routes.py` tiene `@login_required` o `@roles_required(...)`.
      *`grep -n "_bp\.\(get\|post\|put\|patch\|delete\)" -A1 app/backend/app/*/routes.py` y buscar las que no tengan decorador. Excepción esperada: `POST /api/auth/login`.*
- [ ] Operaciones destructivas o sensibles (DELETE, caja, settings, usuarios, impresoras) exigen `@roles_required("admin")`, no solo login.
      *`grep -rn "roles_required" app/backend/app` — si solo aparece la definición, no hay RBAC aplicado.*
- [ ] El orden de decoradores es `@<bp>.<método>(...)` primero y luego `@login_required` (si se invierte, Flask registra la vista sin protección).
- [ ] IDOR/BOLA: en recursos con dueño (`created_by`, `user_id`), filtrar por `g.current_user_id` o validar rol. En este repo los pedidos son del taller (multi-operador), así que el control es por **rol**, no por dueño — documentarlo si cambia.
- [ ] Mass assignment: nunca `Model(**payload)` ni `setattr` en bucle sobre `request.json`. Usar validador con lista blanca (patrón `orders/schemas.py::validate_order_intake`). Campos como `role`, `is_active`, `status`, `created_by`, `id` jamás vienen del cliente.
- [ ] Cambios de estado de pedido solo vía `transition_order` + `state_machine.py`; ningún endpoint escribe `status` directo.
- [ ] Estados terminales (ENTREGADO, CANCELADO) y registros con movimientos de caja no se pueden editar/borrar sin rol admin y auditoría.
- [ ] Frontend: ocultar botones por rol es UX, **no** control. El backend debe devolver 403.
- [ ] SSRF: si algún endpoint recibe una URL (ej. integración futura con la impresora Bambu Lab, webhooks, descarga de STL), validar esquema `https`, host en allowlist, bloquear IPs privadas/loopback/metadata (`169.254.169.254`), sin seguir redirects.

## A02 — Security Misconfiguration

- [ ] `app/backend/Dockerfile` / compose: `flask run --debug` o `FLASK_DEBUG=1` solo en desarrollo. El debugger de Werkzeug en `0.0.0.0` permite ejecución de código si se obtiene el PIN. En prod: gunicorn sin debug.
- [ ] `app/backend/.env` en `.gitignore`; `.env.example` solo con placeholders `<...>`.
- [ ] Sin valores por defecto para secretos en el código (`os.environ.get("X", "valor")`) → usar `app.config.require_env`.
- [ ] Headers en `after_request` (`app/__init__.py`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`; agregar `Referrer-Policy: no-referrer`, `Content-Security-Policy` (en el server que sirve el build de React) y `Strict-Transport-Security` en prod.
- [ ] CORS: hoy no hay `flask-cors` (el frontend usa proxy `setupProxy.js`). Si se agrega, `origins` explícitos, nunca `*` con credenciales.
- [ ] `GET /` no debería listar endpoints ni URLs internas en prod.
- [ ] Puertos expuestos en `docker-compose.yml`: MySQL `3306` publicado en `0.0.0.0` es accesible desde la red → en prod, solo red interna o `127.0.0.1:3306:3306`.
- [ ] Usuario MySQL de la app con privilegios mínimos (sin `GRANT ALL`, sin `SUPER`); el usuario de tests separado si es posible.
- [ ] `DANGEROUSLY_DISABLE_HOST_CHECK=true` del frontend solo en dev.
- [ ] Permisos de archivos subidos (si se agregan): directorio fuera del webroot, sin ejecución.

## A03 — Software Supply Chain Failures

- [ ] `cd app/backend && .venv/bin/pip install pip-audit && .venv/bin/pip-audit -r requirements.txt` sin vulnerabilidades altas.
- [ ] `cd app/frontend && npm audit --omit=dev` sin altas/críticas en dependencias de runtime.
- [ ] `requirements.txt` con versiones exactas (`==`) — ya se cumple. Considerar hashes (`pip-compile --generate-hashes`).
- [ ] `app/frontend/package-lock.json` commiteado; instalar con `npm ci`.
- [ ] Imagen base `python:3.13-slim` con tag fijo (idealmente digest); `apt-get` mínimo.
- [ ] Paquetes abandonados o de la plantilla Babylon que no se usan → eliminarlos (menos superficie). Revisar `react-scripts` (CRA está discontinuado).
- [ ] Herramientas de dev (`pytest`, `ruff`) separadas de las de runtime en la imagen de producción.

## A04 — Cryptographic Failures

- [ ] Contraseñas solo con `User.set_password` / `check_password` (hash con sal, comparación en tiempo constante). Nunca guardar ni comparar en claro.
- [ ] `JWT_SECRET_KEY` ≥ 32 bytes aleatorios (`secrets.token_urlsafe(48)`), desde entorno, distinto por entorno. Rotarlo invalida todos los tokens.
- [ ] Algoritmo JWT fijado (`algorithms=["HS256"]`); nunca aceptar `none` ni el algoritmo del header.
- [ ] HTTPS obligatorio en prod (el login manda la contraseña en el body).
- [ ] Datos personales de clientes (teléfono, email, dirección en `clients`) — evaluar si requieren cifrado en reposo o al menos no exponerse en listados masivos.
- [ ] Nada de `random` para tokens/IDs sensibles → `secrets`.
- [ ] Ningún secreto en logs, tests commiteados, `docker-compose.yml` o seeds (`SEED_OPERATOR_PASSWORD` por entorno).

## A05 — Injection

- [ ] SQL: solo ORM (`Model.query`, `db.select`, `db.update`). Si hay SQL crudo, `db.text("... :param").bindparams(...)`.
      *`grep -rn "text(\|execute(\|f\"SELECT\|f\"UPDATE\|f\"DELETE\|% (" app/backend/app`*
- [ ] `order_by`/columnas dinámicas desde query params → mapear contra allowlist, nunca `getattr(Model, request.args["sort"])` sin validar.
- [ ] `LIKE` con input del usuario: escapar `%` y `_`.
- [ ] XSS en React: prohibido `dangerouslySetInnerHTML` con datos de la API. `href={dato}` → validar que empiece con `http(s)://` (evita `javascript:`).
      *`grep -rn "dangerouslySetInnerHTML\|innerHTML\|eval(" app/frontend/src`*
- [ ] Command injection: sin `os.system`, `subprocess(..., shell=True)`; si se integra con la impresora o slicer, lista de argumentos y valores validados.
- [ ] Path traversal: nombres de archivo del usuario con `werkzeug.utils.secure_filename` y ruta resuelta dentro del directorio base.
- [ ] Inyección en exportes CSV/Excel (si se agregan): escapar celdas que empiezan con `= + - @`.

## A06 — Insecure Design

- [ ] Rate limiting en `POST /api/auth/login` (ej. `Flask-Limiter`: 5/min por IP+usuario) y en endpoints costosos.
- [ ] Máquina de estados (`state_machine.py`) es la única vía para cambiar estado; UPDATE condicional `WHERE status = previous` contra carreras (ya implementado en `transition_order`).
- [ ] Montos: `Decimal`, `> 0`, tope razonable, seña ≤ total, cobro ≤ saldo. Rechazar `NaN`, `Infinity`, strings vacíos.
- [ ] Borrado de pedidos: definir regla de negocio (¿solo en PENDIENTE/COTIZADO? ¿soft delete?). Borrar un pedido entregado pierde trazabilidad aunque la caja quede.
- [ ] Listados sin paginación (`GET /api/orders`) → paginar con límite máximo para evitar respuestas gigantes.
- [ ] Payloads anidados (`items`, `quote_vars`): validar tipo (`dict`/`list`), longitud máxima y `MAX_CONTENT_LENGTH` en Flask.
- [ ] Idempotencia en operaciones de cobro (doble click en "entregar y cobrar" no debe duplicar `CashMovement`).

## A07 — Authentication Failures

- [ ] `login_required` debe validar **igual que** `decode_jwt_token`: `algorithms`, `issuer=ISSUER`, `options={"require": [...]}`. Dos caminos de validación distintos = el más débil manda.
- [ ] Expiración: 24 h hoy. Evaluar 1–8 h + refresh, o al menos revocación (ej. `token_version` en `User` que se incrementa al cambiar contraseña / desactivar).
- [ ] Usuario desactivado → `login_required` ya lo rechaza en cada request (bien).
- [ ] Mensajes de login idénticos para usuario inexistente, inactivo y contraseña incorrecta; verificar la contraseña **antes** de revelar estado del usuario.
- [ ] Fuerza bruta: rate limit + bloqueo temporal tras N fallos por usuario.
- [ ] Recuperación de cuenta (si se agrega): token de un solo uso, expira en minutos, no revela si el usuario existe.
- [ ] Frontend: token en `localStorage` es robable ante cualquier XSS → mantener A05 estricto; alternativa: cookie `HttpOnly; Secure; SameSite=Strict` + protección CSRF. Limpiar token en logout y en 401.
- [ ] Contraseñas: longitud mínima ≥ 12 al crearlas/cambiarlas; la del seed viene de entorno.
- [ ] Ningún JWT ni credencial embebida en el frontend como "fallback de desarrollo" (ya pasó: `DEFAULT_DEV_TOKEN` en `ordersApi.js`/`cashboxApi.js`, firmado con el secreto por defecto = acceso admin sin login).
      *`grep -rn "eyJhbGci\|DEV_TOKEN\|Bearer ey" app/frontend/src`*

## A08 — Software or Data Integrity Failures

- [ ] Sin `pickle.loads`, `yaml.load` (usar `safe_load`), `eval`/`exec` sobre datos externos.
- [ ] Migraciones Alembic (`app/backend/migrations/versions/`) revisadas en PR; nunca autogeneradas y aplicadas sin leer.
- [ ] Webhooks entrantes (pagos, Bambu Lab cloud, etc.) verifican firma HMAC con `hmac.compare_digest` y timestamp anti-replay.
- [ ] Integridad contable: `CashMovement` no se edita/borra; correcciones como movimiento compensatorio. Al borrar pedidos se hace `order_id = NULL` (ok) — dejar registro de quién borró.
- [ ] Datos que vuelven del cliente y que el servidor ya calculó (precio, totales) se **recalculan** en el backend, no se confían.
- [ ] Builds: `npm ci` / `pip install` desde lockfile en CI, no desde rangos.

## A09 — Security Logging & Alerting Failures

Loguear (con `user_id`, IP, timestamp, recurso):
- [ ] Login exitoso y fallido (sin la contraseña).
- [ ] 401/403 repetidos.
- [ ] Borrado de pedidos, cambios de estado (ya en `OrderStatusHistory`), movimientos de caja, cambios en `settings`.
- [ ] Errores 500 con stack trace **solo en el log del servidor**.

NO loguear:
- [ ] Contraseñas, tokens JWT, header `Authorization`, `DATABASE_URL`, `JWT_SECRET_KEY`, contenido de `.env`.
- [ ] Datos personales completos de clientes (enmascarar teléfono/email).

Verificar:
- [ ] `grep -rn "print(\|logger\.\|logging\." app/backend/app` — que no imprima payloads completos de request.
- [ ] Frontend: `console.log` de respuestas con token o datos de clientes eliminados en build de prod.

## A10 — Mishandling of Exceptional Conditions

- [ ] Nunca `return jsonify(error=str(exc)), 500` en un `except Exception` — filtra detalles internos (mensajes de PyMySQL, rutas, SQL). Loguear y devolver mensaje genérico.
- [ ] Registrar un `@app.errorhandler(Exception)` / `errorhandler(500)` global que devuelva JSON genérico.
- [ ] `str(exc)` de excepciones **de dominio** (ValueError propios, `InvalidOrderStateError`) es aceptable si el mensaje lo escribimos nosotros y no incluye datos internos.
- [ ] Todo `commit()` envuelto en `try/except: rollback(); raise`.
- [ ] Fail-closed: si falla la validación del token, la consulta del usuario o el chequeo de rol → 401/403, nunca dejar pasar.
- [ ] `request.get_json(silent=True) or {}` + verificar `isinstance(payload, dict)` (un JSON `[]` o `"x"` no debe romper con 500).
- [ ] `int()`, `Decimal()` sobre input del usuario dentro de `try` con 422.
- [ ] Debug apagado en prod (A02): el debugger de Werkzeug muestra stack traces y consola interactiva.
