"""Fixtures RBAC (rbac-access-control, etapa 4).

`rbac` arma usuarios/grupos/roles de prueba (nunca usa el id=1 superusuario para los casos
con permisos). `guarded_app` es una app aparte con un blueprint de prueba protegido con
`permission_required`, para no proteger todavía las rutas reales del taller.
"""

import pytest

from app import create_app
from app.auth.models import User
from app.extensions import db
from app.rbac.models import Group, GroupRole, Permission, Role, RolePermission, UserGroup, UserRole
from app.rbac.services import sync_permission_catalog
from tests.conftest import make_token


class RbacFactory:
    def __init__(self, app):
        self.app = app

    def sync_catalog(self) -> None:
        with self.app.app_context():
            sync_permission_catalog()
            db.session.commit()
            db.session.remove()

    def user(self, username: str, *, is_superuser: bool = False, is_active: bool = True) -> int:
        with self.app.app_context():
            u = User(username=username, role="admin" if is_superuser else "operator",
                     is_active=is_active, is_superuser=is_superuser)
            u.set_password("clave-de-prueba-123")
            db.session.add(u)
            db.session.commit()
            user_id = u.id
            db.session.remove()
        return user_id

    def role(self, name: str, perms) -> int:
        with self.app.app_context():
            role = Role(name=name)
            db.session.add(role)
            db.session.flush()
            codes = [str(p) for p in perms]
            for perm in Permission.query.filter(Permission.code.in_(codes)).all():
                db.session.add(RolePermission(role_id=role.id, permission_id=perm.id))
            db.session.commit()
            role_id = role.id
            db.session.remove()
        return role_id

    def group(self, name: str, role_ids=()) -> int:
        with self.app.app_context():
            group = Group(name=name)
            db.session.add(group)
            db.session.flush()
            for role_id in role_ids:
                db.session.add(GroupRole(group_id=group.id, role_id=role_id))
            db.session.commit()
            group_id = group.id
            db.session.remove()
        return group_id

    def add_member(self, user_id: int, group_id: int) -> None:
        with self.app.app_context():
            db.session.add(UserGroup(user_id=user_id, group_id=group_id))
            db.session.commit()
            db.session.remove()

    def remove_member(self, user_id: int, group_id: int) -> None:
        with self.app.app_context():
            UserGroup.query.filter_by(user_id=user_id, group_id=group_id).delete()
            db.session.commit()
            db.session.remove()

    def assign_direct(self, user_id: int, role_id: int, reason: str = "excepción de prueba") -> None:
        with self.app.app_context():
            db.session.add(UserRole(user_id=user_id, role_id=role_id, reason=reason, assigned_by=1))
            db.session.commit()
            db.session.remove()

    def headers(self, user_id: int) -> dict:
        return {"Authorization": f"Bearer {make_token(self.app, user_id)}"}


@pytest.fixture
def rbac(app):
    return RbacFactory(app)


@pytest.fixture(scope="module")
def guarded_app(app):
    """App con rutas de prueba protegidas. Comparte base y JWT_SECRET_KEY con `app`."""
    from flask import Blueprint, jsonify

    from app.auth.security import login_required
    from app.rbac.constants import Perm
    from app.rbac.security import get_user_permissions, permission_required

    bp = Blueprint("rbac_test_guarded", __name__, url_prefix="/_test/rbac")

    @bp.get("/orders-read")
    @permission_required(Perm.ORDERS_READ)
    def orders_read():
        return jsonify(ok=True), 200

    @bp.get("/orders-read-and-delete")
    @permission_required(Perm.ORDERS_READ, Perm.ORDERS_DELETE)
    def orders_read_and_delete():
        return jsonify(ok=True), 200

    @bp.get("/cache-probe")
    @login_required
    def cache_probe():
        first = get_user_permissions()
        second = get_user_permissions()
        return jsonify(same_object=first is second, permissions=sorted(first)), 200

    test_app = create_app(
        {
            "SQLALCHEMY_DATABASE_URI": app.config["SQLALCHEMY_DATABASE_URI"],
            "JWT_SECRET_KEY": app.config["JWT_SECRET_KEY"],
            "TESTING": True,
        }
    )
    test_app.register_blueprint(bp)
    return test_app


@pytest.fixture
def guarded_client(guarded_app):
    return guarded_app.test_client()
