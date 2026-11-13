"""Soporte para los tests de administración RBAC (etapa 6, blueprint /api/rbac).

`setup_admin` arma un administrador NO superusuario: tiene `rbac:read` y `rbac:manage`
a través del rol "Admin seguridad" del grupo "Seguridad" (así se pueden probar
SELF_ASSIGNMENT y SELF_LOCKOUT). El usuario id=1 de `tests/conftest.py` es superusuario.
"""

from types import SimpleNamespace

from app.extensions import db
from app.rbac.constants import Perm

ADMIN_ROLE = "Admin seguridad"
ADMIN_GROUP = "Seguridad"
SUPERUSER_ID = 1

SELF_ASSIGNMENT_BODY = {
    "error": "No podés asignarte roles ni permisos a vos mismo",
    "code": "SELF_ASSIGNMENT",
}


def setup_admin(rbac, username: str = "admin") -> SimpleNamespace:
    rbac.sync_catalog()
    admin_id = rbac.user(username)
    role_id = rbac.role(ADMIN_ROLE, [Perm.RBAC_READ, Perm.RBAC_MANAGE])
    group_id = rbac.group(ADMIN_GROUP, [role_id])
    rbac.add_member(admin_id, group_id)
    return SimpleNamespace(
        id=admin_id, role_id=role_id, group_id=group_id, headers=rbac.headers(admin_id)
    )


def reader(rbac, username: str = "lector") -> SimpleNamespace:
    """Usuario con solo `rbac:read` (vía grupo "Lectores")."""
    user_id = rbac.user(username)
    role_id = rbac.role("Lector seguridad", [Perm.RBAC_READ])
    rbac.add_member(user_id, rbac.group("Lectores", [role_id]))
    return SimpleNamespace(id=user_id, role_id=role_id, headers=rbac.headers(user_id))


def count(app, model, **filters) -> int:
    with app.app_context():
        total = model.query.filter_by(**filters).count()
        db.session.remove()
    return total


def fetch(app, model, **filters):
    """Primera fila que coincide, como dict de columnas (o None)."""
    with app.app_context():
        row = model.query.filter_by(**filters).first()
        data = None if row is None else {c.name: getattr(row, c.name) for c in model.__table__.columns}
        db.session.remove()
    return data


def assert_error(resp, status: int, code: str) -> dict:
    assert resp.status_code == status, resp.get_json()
    body = resp.get_json()
    assert body["code"] == code
    assert isinstance(body["error"], str) and body["error"]
    return body
