# Living Specification: auth

> **The source of truth for what this domain does right now.**
> Every requirement is written in declarative business language.

## Purpose
Garantizar la seguridad, autenticación y autorización del sistema Delivery3D aplicando las directrices de **"API Security in Action" (Neil Madden)** y el **OWASP API Security Top 10**, mitigando vulnerabilidades críticas como BOLA (Broken Object Level Authorization), Broken Authentication y BOPLA (Broken Object Property Level Authorization / Mass Assignment).

---

## Active Requirements

### Requirement: REQ-AUTH-01 Autenticación Segura y Mitigación de Broken Authentication (OWASP API2:2023)
El sistema DEBE autenticar usuarios contra credenciales almacenadas con hashing criptográfico salteado y emitir tokens JWT con expiración explícita y algoritmo fijado (HS256).

#### Scenarios
```gherkin
Scenario: Inicio de sesión exitoso
  GIVEN un usuario activo registrado en el sistema
  WHEN envía POST /api/auth/login con credenciales válidas
  THEN el sistema retorna código 200 con el token JWT, expiración y datos del usuario (id, username, role)

Scenario: Rechazo de credenciales inválidas sin enumeración de usuarios
  GIVEN credenciales incorrectas (usuario inexistente o clave errónea)
  WHEN envía POST /api/auth/login
  THEN el sistema rechaza la solicitud con código HTTP 401 y mensaje genérico "Credenciales inválidas"
  AND no revela si el usuario existe o no

Scenario: Rechazo de token expirado o firma inválida
  GIVEN un token JWT expirado o firmado con clave distinta
  WHEN el cliente realiza una petición a un endpoint protegido
  THEN el sistema retorna código HTTP 401 "Token inválido o expirado"
```

---

### Requirement: REQ-AUTH-02 Mitigación de BOLA (Broken Object Level Authorization - OWASP API1:2023)
El sistema DEBE verificar que todo acceso o mutación a entidades del taller esté debidamente autorizado e identificar al operador mediante el claim `sub` del token, vinculando inequívocamente las operaciones a su identidad.

#### Scenarios
```gherkin
Scenario: Registro de operaciones vinculado al usuario autenticado
  GIVEN un operador autenticado con id=5
  WHEN crea un movimiento de caja o actualiza un pedido
  THEN la base de datos registra user_id=5 o changed_by=5 obtenido del contexto del token
  AND ignora cualquier identificador de usuario arbitrario inyectado en el cuerpo de la petición
```

---

### Requirement: REQ-AUTH-03 Mitigación de BOPLA y Mass Assignment (OWASP API3:2023)
El sistema DEBE extraer únicamente atributos permitidos (lista blanca) de las cargas útiles HTTP y NUNCA exponer atributos sensibles (tales como `password_hash`).

#### Scenarios
```gherkin
Scenario: Exclusión estricta de campos sensibles en respuestas
  WHEN se consulta GET /api/auth/me o se serializa un usuario
  THEN la respuesta incluye { id, username, role, is_active, created_at }
  AND NUNCA incluye password_hash
```
