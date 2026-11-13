# Technical Circuit: auth

> **Living Technical Memory: How work runs and where execution flows.**

**Last Updated:** 2026-09-16 · **Changes that shaped this:** `auth-security-owasp`

---

## Entry Points

| Entry Point | Trigger Mechanism | File:Line |
|---|---|---|
| Iniciar Sesión | HTTP POST `/api/auth/login` | `app/backend/app/auth/routes.py` |
| Consultar Identidad | HTTP GET `/api/auth/me` | `app/backend/app/auth/routes.py` |
| Guard de Autenticación | `@login_required` decorator | `app/backend/app/auth/security.py` |
| Guard de Roles | `@roles_required(*roles)` decorator | `app/backend/app/auth/security.py` |

---

## Execution Path (OWASP & Neil Madden Patterns)

```
POST /api/auth/login
  → Extract username, password (Strict Whitelist - Anti BOPLA/Mass Assignment)
  → Fetch User where username == input_username
  → If not user or not user.is_active or not check_password_hash(user.password_hash, password):
      → Abort 401 "Credenciales inválidas" (Generic error - Anti User Enumeration)
  → Build JWT claims:
      { sub: str(user.id), username: user.username, role: user.role, iss: "delivery3d", iat: now, exp: now + 24h }
  → Sign JWT using HS256 + app.config['JWT_SECRET_KEY']
  → Return { token, user: user.to_dict(), expires_in: 86400 }

@login_required (Any Protected Route)
  → Inspect Authorization header: "Bearer <token>"
  → Verify presence and format
  → jwt.decode(token, secret, algorithms=["HS256"]) (Strict Algorithm Pinning)
  → Check expiration, signature, and issuer
  → Fetch user from DB or verify active status
  → Assign g.current_user_id = user.id, g.current_user = user
  → Proceed to protected view
```

---

## File Map

| File | Responsibility |
|---|---|
| `app/backend/app/auth/models.py` | Modelo ORM `User` con `password_hash`, `role`, `is_active` y serialización segura `to_dict()` |
| `app/backend/app/auth/security.py` | Generación y verificación de JWT, decorators `@login_required`, `@roles_required`, hashing de contraseñas |
| `app/backend/app/auth/services.py` | Servicios de negocio de autenticación y gestión de usuarios |
| `app/backend/app/auth/routes.py` | Endpoints REST de login, me y usuarios |
| `app/frontend/src/features/auth/authApi.js` | Cliente de API para login y verificación de sesión |
| `app/frontend/src/features/auth/AuthContext.js` | Contexto de React para sesión de usuario e interceptores Axios |
| `app/frontend/src/features/auth/LoginView.jsx` | Pantalla de inicio de sesión con PrimeReact |
