# Change Proposal: auth-security-owasp

## 1. Context & Motivation
Actualmente en Delivery3D, el módulo de autenticación funciona con un guardia temporal (`login_required` en `app/backend/app/auth/security.py`) que decodifica cualquier JWT sin verificar la existencia ni estado activo del usuario en la base de datos, recurriendo a un operador ficticio `sub="1"`, con contraseñas en estado `"unset"`. El frontend utiliza un token estático (`DEFAULT_DEV_TOKEN`) en `localStorage`.

Para cumplir con los estándares de la industria, las directrices del libro **"API Security in Action" (Neil Madden)** y el **OWASP API Security Top 10**, se debe implementar un sistema completo y robusto de autenticación y autorización que mitigue:
- **BOLA (Broken Object Level Authorization / API1:2023):** Validar la pertenencia y contexto de las entidades asignando siempre la identidad comprobada del token.
- **Broken Authentication (API2:2023):** Implementar hashing seguro de contraseñas, caducidad estricta de tokens, fijación de algoritmos (`HS256`), protección contra enumeración de usuarios y endpoints de inicio de sesión (`/api/auth/login`) y perfil (`/api/auth/me`).
- **BOPLA / Mass Assignment & Excessive Data Exposure (API3:2023):** Filtrado estricto de campos de entrada (listas blancas) y exclusión absoluta de datos sensibles (`password_hash`) en respuestas y serializadores.

## 2. Goals
1. **Modelado Normalizado de Usuario:** Incorporar columnas `role` (ej. `'admin'`, `'operator'`) e `is_active` (boolean) en la tabla `users` mediante migración Alembic.
2. **Servicios de Autenticación y Criptografía:** Hashing con salt usando `werkzeug.security` (`scrypt` / `pbkdf2:sha256`) y emisión de JWT con claims estándar (`sub`, `username`, `role`, `iss`, `exp`, `iat`).
3. **Endpoints REST de Autenticación:** `POST /api/auth/login` y `GET /api/auth/me`.
4. **Guardias de Seguridad Reforzados:** Decoradores `@login_required` y `@roles_required(*roles)`.
5. **Frontend Seguro:**
   - Contexto de autenticación en React (`AuthContext`) con interceptor Axios que inyecta el token y redirige a `/login` ante un error 401.
   - Pantalla de inicio de sesión [`LoginView.jsx`](file:///home/diegomotta/Documentos/Personal%20Develops/Delivery3D/frontend/src/features/auth/LoginView.jsx).
   - Botón funcional de Cerrar Sesión (Logout) e indicador del operador activo en la barra superior (`AppTopbar`).

## 3. Non-Goals
- Autenticación OAuth2 / Social Login externa (el sistema es para uso de taller local/privado).
- Autenticación multifactor biométrica (fuera de alcance en esta fase).
