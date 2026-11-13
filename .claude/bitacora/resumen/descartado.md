# Descartado

Enfoques probados que fallaron o se rechazaron, para no volver a proponerlos.

- 2026-11-12 · Restringir el borrado de pedidos a admins como "arreglo de seguridad" · por qué no: hay una spec aprobada que permite borrar a cualquier operador, con tests que lo comprueban. Si se quiere cambiar, va por un cambio OpenSpec · ref: [informe](../../../docs/informes/2026-11-12-informe-sesion.md)
- 2026-11-12 · Usar tal cual los textos del RBAC escritos para FastAPI · por qué no: generaban estructura y código que no encaja con Flask (`src/rbac`, `Depends`) · ref: [informe](../../../docs/informes/2026-11-12-informe-sesion.md)
- 2026-11-12 · Skill de backend largo (164 líneas) · por qué no: repetía lo que el código ya muestra; se recortó a 47 líneas sin perder rendimiento en las evaluaciones · ref: [informe](../../../docs/informes/2026-11-12-informe-sesion.md)
