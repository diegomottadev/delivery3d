# Implementation Tasks: auth-security-owasp

- [x] 1. Modelo de Datos y Migración Alembic
  - [x] 1.1 Actualizar modelo `User` en `backend/app/auth/models.py` con `role`, `is_active` y métodos de hash/to_dict.
  - [x] 1.2 Generar y aplicar migración Alembic incremental.
  - [x] 1.3 Actualizar script `seeds/seed_operator.py` para generar hash de contraseña real (`operador123`).

- [x] 2. Servicios de Seguridad Backend y Rutas (TDD)
  - [x] 2.1 Implementar servicios criptográficos y de emisión de JWT en `backend/app/auth/security.py`.
  - [x] 2.2 Implementar `login_user` y `get_user_by_id` en `backend/app/auth/services.py`.
  - [x] 2.3 Implementar endpoints REST en `backend/app/auth/routes.py` (`POST /login`, `GET /me`).
  - [x] 2.4 Registrar blueprint de auth y cabeceras de seguridad HTTP en `backend/app/__init__.py`.
  - [x] 2.5 Crear test suite exhaustiva en `backend/tests/test_auth.py` verificando BOLA, Broken Auth, BOPLA.
  - [x] 2.6 Ejecutar suite de pruebas backend (100% verde) y verificar linter `ruff`.

- [x] 3. Frontend: Contexto de Autenticación, Login y Logout
  - [x] 3.1 Crear `frontend/src/features/auth/authApi.js` (`login`, `getMe`).
  - [x] 3.2 Crear `frontend/src/features/auth/AuthContext.js` con manejo de sesión, interceptor 401 y Logout.
  - [x] 3.3 Crear pantalla de inicio de sesión `frontend/src/features/auth/LoginView.jsx`.
  - [x] 3.4 Actualizar `App.js` y `AppTopbar.js` para mostrar usuario activo y botón de cerrar sesión.
  - [x] 3.5 Escribir tests unitarios en frontend (`LoginView.test.js`).
  - [x] 3.6 Verificar compilación limpia y tests en frontend.

- [x] 4. Sincronización y Cierre OpenSpec
  - [x] 4.1 Actualizar `openspec/project.md`.
