# Technical Design: auth-security-owasp

## 1. Threat Modeling & OWASP API Top 10 Mitigation Plan

### Mitigación 1: Broken Authentication (OWASP API2:2023)
- **Hashing de Contraseñas:** `generate_password_hash(password, method='pbkdf2:sha256')` (salteado, resistente a ataques por tablas arcoíris y GPUs).
- **Verificación en Tiempo Constante:** `check_password_hash(hash, password)` para prevenir ataques de temporización (*timing attacks*).
- **Estructura de Claims del JWT:**
  ```json
  {
    "sub": "1",
    "username": "operador",
    "role": "admin",
    "iss": "delivery3d-api",
    "iat": 1789578000,
    "exp": 1789664400
  }
  ```
- **Pinning de Algoritmo:** Exigencia obligatoria de `algorithms=["HS256"]` al decodificar para impedir el ataque *alg: none*.
- **Prevención de Enumeración de Usuarios:** Mensajes de error idénticos (*"Credenciales incorrectas"*) tanto ante usuario inexistente como clave errónea.

### Mitigación 2: BOLA - Broken Object Level Authorization (OWASP API1:2023)
- El guard `@login_required` extrae `sub`, carga el registro de `User` y fija `g.current_user_id` y `g.current_user`.
- Toda operación de creación o mutación toma `user_id` estrictamente desde `g.current_user_id` descartando identificadores falsificados en el cuerpo JSON.
- `@roles_required('admin')` restringe operaciones privilegiadas (configuraciones críticas del taller).

### Mitigación 3: BOPLA - Mass Assignment & Data Exposure (OWASP API3:2023)
- **Whitelisting de Entradas:** Los controladores extraen únicamente campos explícitos (`username = data.get("username")`, `password = data.get("password")`). Queda prohibido el desempaquetado masivo `Model(**data)`.
- **Serialización Segura:** `User.to_dict()` nunca retorna `password_hash`.

### Mitigación 4: Cabeceras de Seguridad HTTP (Madden Ch. 2)
- En un decorador/hook global `after_request`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`

## 2. Database Schema (MySQL 8.0 InnoDB)

```sql
ALTER TABLE users
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'operator',
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
```

## 3. REST API Endpoints

- `POST /api/auth/login`: `{ username, password }` ➔ 200 `{ token, user, expires_in }` | 401 `{ error: "Credenciales inválidas" }`
- `GET /api/auth/me`: ➔ 200 `{ id, username, role, is_active, created_at }`
