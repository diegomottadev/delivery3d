# Informe de la sesión: seguridad, skills y agentes

**Fecha:** 12/11/2026 · **Proyecto:** Delivery3D

Este informe está escrito para leerse sin conocimientos técnicos profundos. Resume qué se hizo, qué aprendí trabajando en este proyecto, qué skills nuevos recomiendo y cómo conviene usar agentes de ahora en adelante.

---

## 1. Qué se hizo hoy

| Tema | Resultado |
|---|---|
| Conexión a la base con DBeaver | Datos de conexión verificados. |
| Contraseñas fuera del código | Todo pasó a `backend/.env`, y a Claude le quedó bloqueado leerlo. Quedan pasos tuyos: crear el `.env` y cambiar la contraseña de MySQL. |
| Skill `owasp-security` | Creado y probado en una revisión real. |
| Arreglos de seguridad | 11 arreglos con tests: tokens que no vencían, errores que mostraban detalles internos, límite de intentos de login, registro de quién borra pedidos, entre otros. Además apareció y se eliminó un **token de administrador escrito en el frontend**: cualquiera podía entrar como admin sin contraseña. |
| Skill `flask-backend-practices` | Creado, medido en 5 pruebas con y sin el skill, y recortado de 164 a 47 líneas sin perder lo que aporta. |
| Control de acceso por roles (RBAC) | Dos agentes, uno de backend y otro de frontend, entregaron el diseño de la base de datos y el plan de pantallas. Esperan tus respuestas antes de escribir código. |

---

## 2. Lo que aprendí (y por qué importa)

### 2.1 El código del proyecto ya "enseña" la mayoría de las reglas
En las pruebas de skills, un agente **sin** el skill hizo casi todo igual de bien que uno **con** el skill. El motivo es que el proyecto está ordenado: tiene `CLAUDE.md`, specs en OpenSpec, un módulo modelo (`orders/`) y tests con fixtures claros. El modelo lee eso y copia el estilo.

**Conclusión:** un skill rinde cuando escribe lo que el código **no muestra**: decisiones del negocio, trampas de MySQL, el formato de una auditoría o "qué hacer si un test molesta". Repetir lo que ya está en el código solo agrega texto.

### 2.2 Lo que parece un error puede ser una decisión
La revisión de seguridad marcó como problema que cualquier operador pudiera borrar pedidos. Pero había una **spec aprobada** que pedía exactamente eso, con tests que lo comprobaban. Arreglarlo en silencio habría roto una decisión del negocio.

**Conclusión:** antes de cambiar un comportamiento, mirar las specs. Quedó como regla número 1 del skill de backend.

### 2.3 Un cambio de configuración puede tumbar la app
Al pasar las contraseñas al `.env`, el backend en Docker dejó de funcionar hasta que existiera ese archivo, y vos lo notaste porque no podías borrar un pedido. Te tendría que haber avisado antes.

**Conclusión:** todo cambio que exija una acción tuya (crear un archivo, reiniciar un contenedor) se avisa **antes**, junto con lo que deja de andar mientras tanto.

### 2.4 Los pedidos escritos para otro proyecto hay que traducirlos
Los textos del RBAC estaban escritos para FastAPI y este proyecto usa Flask. Copiarlos tal cual habría producido carpetas y código que no encajan. Antes de pasárselos a los agentes los traduje: `src/rbac` pasó a `backend/app/rbac`, `Depends` a un decorador, y así con el resto.

### 2.5 Trabajar con dos agentes en paralelo funciona, con condiciones
- **Lo bueno:** los dos relevaron el código y planificaron al mismo tiempo, en unos 4 minutos. Cada uno encontró cosas que el otro no veía. Por ejemplo, el backend detectó que el frontend usa `user.role.toUpperCase()` y se rompería si se borraba ese campo.
- **Lo que hay que cuidar:** los agentes **no hablan directamente entre sí ni con vos**; yo hago de puente. Hubo pequeñas diferencias en lo que cada uno imaginó. El frontend nombró `/effective-access` un endpoint que tu pedido llama `/access`, y propuso permisos con un formato distinto al acordado. Si no se detectan temprano, terminan en código que no encaja.
- **Lo que cuesta:** cada agente usa unos 100.000 tokens por ronda. Para tareas chicas, un solo agente sale más barato y es igual de bueno.

### 2.6 El proyecto no está en Git
Hoy se modificaron decenas de archivos sin historial de cambios. Si algo sale mal, no hay forma fácil de volver atrás ni de ver qué cambió. Además, los agentes que trabajan en paralelo escribiendo código necesitan Git para no pisarse: cada uno trabaja en su propia copia (*worktree*) y después se unen los cambios. **Es la recomendación más importante de este informe** (ver sección 4).

**Actualización (ya pasó):** se inició Git y, en la ronda siguiente, el agente de backend agregó columnas al modelo de usuarios mientras trabajaba en la misma carpeta que usa tu contenedor, que toma el código en vivo. Como la migración todavía no estaba aplicada, **todos los logins dieron error 500** durante unos minutos. Se resolvió moviendo el trabajo de los agentes a una copia aislada (`.worktrees/rbac`, rama `feat/rbac`). La app que usás no ve nada de lo que está en esa copia hasta que se aprueba y se une. Regla desde ahora: **los agentes que escriben código trabajan siempre en un worktree.**

---

## 3. Skills nuevos que recomiendo

En orden de prioridad:

### 3.1 `rbac-proteger-endpoint` (crear después de la etapa 5 del RBAC)
**Para qué:** cada vez que se agregue un endpoint o una pantalla, recorrer los pasos que hoy nadie ve juntos:
1. Agregar el permiso al enum `Perm`, con su descripción.
2. Correr el seed de permisos.
3. Poner `@permission_required(Perm.X)` en la ruta.
4. Agregar el mismo permiso al espejo `PERM` del frontend.
5. Proteger el botón con `<Can>` y la ruta con `<RequirePermission>`.
6. Escribir los tests de 401 y 403.

**Por qué:** es justo el tipo de conocimiento que el código no muestra, porque está repartido entre backend, frontend, seed y tests. Si se olvida un paso, el endpoint queda abierto o el botón aparece y después falla.

### 3.2 `contrato-api-first` (coordinación backend ↔ frontend)
**Para qué:** antes de que backend y frontend escriban código, acordar un único archivo de contrato (`openspec/changes/<cambio>/api-contract.md`) con cada endpoint, ejemplos de request y response y códigos de error. Los dos agentes lo leen. Si uno necesita cambiarlo, se avisa y se actualiza el archivo, no se "adivina".

**Por qué:** hoy las diferencias de nombres entre los dos planes se detectaron porque yo las revisé a mano. Con un contrato escrito se detectan solas.

### 3.3 `react-frontend-practices` (versión corta)
**Para qué:** lo mismo que hicimos con el backend, pero solo con lo que el código del frontend no muestra:
- cómo mostrar un 403 sin romper la pantalla;
- que ocultar un botón no es seguridad;
- que nunca hay tokens escritos en el código;
- que el menú se arma desde una configuración;
- dónde viven los permisos.

**Por qué:** el frontend es la plantilla Babylon con agregados, así que tiene menos estructura propia que el backend. Lo conviene medir con pruebas, como hicimos con el de backend, antes de darlo por bueno.

**No recomiendo** crear un skill que repita lo que ya está en el código o en `CLAUDE.md`. Las pruebas de hoy mostraron que no cambia el resultado.

---

## 4. Sobre usar agentes y el "harness" de Claude Code

El *harness* es el conjunto de herramientas de Claude Code que rodean al modelo: agentes en paralelo, *hooks* (acciones automáticas), permisos, *worktrees* y evaluaciones de skills. Mi recomendación es usarlo **cuando aporta**, no siempre:

| Situación | Recomendación |
|---|---|
| Arreglo chico, una pregunta, un archivo | **Un solo agente** (esta conversación). Más barato y rápido. |
| Funcionalidad que toca backend y frontend | **Dos agentes en paralelo**, con contrato de API primero y vos aprobando cada etapa. |
| Revisar algo grande (seguridad, auditoría) | Un agente por área, solo lectura, y yo consolido. |
| Medir si un skill sirve | Evaluaciones con y sin skill, como hicimos hoy. |

**Cosas concretas para configurar** (te las armo cuando digas):
1. **Iniciar Git en el proyecto** (`git init` y un primer commit con lo que hay hoy). Es lo primero, antes de que los agentes escriban el código del RBAC.
2. **Worktrees por agente:** con Git, cada agente trabaja en su propia copia y no se pisan.
3. **Hooks automáticos:**
   - correr `ruff` después de cada cambio en Python;
   - correr los tests del módulo tocado antes de dar algo por terminado.

   Así no depende de que el agente "se acuerde".
4. **Bloqueo del `.env`:** ya está hecho en `.claude/settings.json`.

---

## 5. Qué queda pendiente

1. **Tuyo:** crear `backend/.env`, cambiar la contraseña de MySQL y recrear el contenedor del backend.
2. **Tuyo:** responder las preguntas del RBAC. Están en `openspec/changes/rbac-access-control/design.md` (backend) y `frontend-plan.md` (frontend), y resumidas en el chat.
3. **Siguiente:** iniciar Git y después avanzar con la etapa 2 del RBAC (la migración de la base).
