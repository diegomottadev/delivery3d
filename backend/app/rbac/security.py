"""Autorización RBAC por request (rbac-access-control, etapa 5).

- El JWT solo identifica (`sub`); los permisos se resuelven contra la base en cada request.
- `get_user_permissions()` cachea el resultado en `flask.g` (una consulta por request como
  máximo), atado al request actual para que nunca se reutilice en otro.
- `permission_required(*perms)` exige TODOS los permisos (AND). Superusuario pasa.
  Inactivo -> 401 (lo resuelve `login_required`, antes de mirar `is_superuser`).
"""

from functools import wraps

from flask import g, has_request_context, jsonify, request

from app.auth.security import login_required
from app.rbac.constants import Perm
from app.rbac.services import get_effective_permissions

ALL_PERMISSION_CODES: frozenset[str] = frozenset(p.value for p in Perm)
FORBIDDEN_MESSAGE = "Acceso denegado: permisos insuficientes"
_CACHE_ATTR = "_rbac_permissions_cache"


def _cache_owner() -> tuple:
    req = request._get_current_object() if has_request_context() else None
    return (id(req), g.current_user_id)


def get_user_permissions() -> frozenset[str]:
    """Permisos efectivos del usuario autenticado (`g.current_user`, de `login_required`).

    Superusuario -> catálogo completo. Cacheado por request en `flask.g`.
    """
    owner = _cache_owner()
    cached = g.get(_CACHE_ATTR)
    if cached is not None and cached[0] == owner:
        return cached[1]

    user = g.current_user
    permissions = ALL_PERMISSION_CODES if user.is_superuser else get_effective_permissions(user.id)
    setattr(g, _CACHE_ATTR, (owner, permissions))
    return permissions


def has_permission(perm: Perm) -> bool:
    return perm.value in get_user_permissions()


def permission_required(*perms: Perm):
    """Exige que el usuario autenticado tenga TODOS los permisos indicados (AND)."""
    if not perms:
        raise ValueError("permission_required necesita al menos un permiso")
    for perm in perms:
        if not isinstance(perm, Perm):
            raise TypeError(f"permission_required solo acepta miembros de Perm, no {perm!r}")
    required = frozenset(p.value for p in perms)

    def decorator(view):
        @wraps(view)
        @login_required
        def wrapped(*args, **kwargs):
            if not required <= get_user_permissions():
                return jsonify(error=FORBIDDEN_MESSAGE, code="FORBIDDEN"), 403
            return view(*args, **kwargs)

        return wrapped

    return decorator
