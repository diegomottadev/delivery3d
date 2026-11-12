# Specification Delta: auth-security-owasp

## Added Requirements

### REQ-AUTH-01 Autenticación Segura y Prevención de Broken Authentication
El sistema DEBE autenticar usuarios mediante `POST /api/auth/login` validando contraseñas con hashing criptográfico seguro (PBKDF2/scrypt salteado) y emitiendo tokens JWT con expiración estricta (24h) y algoritmo HS256.

### REQ-AUTH-02 Mitigación de BOLA (Broken Object Level Authorization)
El sistema DEBE resolver la identidad del operador desde el claim `sub` del token y asignarla automáticamente en cada mutación de datos.

### REQ-AUTH-03 Mitigación de BOPLA (Broken Object Property Level Authorization)
El sistema DEBE emplear whitelisting estricto de campos en peticiones y serializar entidades de usuario sin exponer contraseñas hasheadas.
