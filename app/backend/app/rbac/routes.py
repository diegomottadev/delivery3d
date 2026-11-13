"""Blueprint /api/rbac — administración de accesos (rbac-access-control, etapa 6).

Contrato: openspec/changes/rbac-access-control/api-contract.md.
Lecturas (incluidos los endpoints de impacto) -> `rbac:read`; escrituras -> `rbac:manage`.
Orden de chequeo: FORBIDDEN -> NOT_FOUND (path) -> VALIDATION_ERROR -> NOT_FOUND (ids del
body) -> SELF_ASSIGNMENT / SELF_LOCKOUT -> conflictos. Sin ORM acá: todo pasa por services.
"""

from flask import Blueprint, g, jsonify, request

from app.http import InvalidJsonBody, json_body
from app.rbac import schemas
from app.rbac import services as svc
from app.rbac.constants import Perm
from app.rbac.schemas import ValidationError
from app.rbac.security import permission_required

rbac_bp = Blueprint("rbac", __name__, url_prefix="/api/rbac")

read_required = permission_required(Perm.RBAC_READ)
manage_required = permission_required(Perm.RBAC_MANAGE)

_ERRORS: dict[type[svc.RbacError], tuple[int, str]] = {
    svc.RbacNotFoundError: (404, "NOT_FOUND"),
    svc.NameTakenError: (409, "NAME_TAKEN"),
    svc.AlreadyMemberError: (409, "ALREADY_MEMBER"),
    svc.AlreadyAssignedError: (409, "ALREADY_ASSIGNED"),
    svc.RoleInUseError: (409, "ROLE_IN_USE"),
    svc.SelfAssignmentError: (409, "SELF_ASSIGNMENT"),
    svc.SelfLockoutError: (409, "SELF_LOCKOUT"),
}


@rbac_bp.errorhandler(svc.UnknownPermissionError)
def _unknown_permission(exc: svc.UnknownPermissionError):
    return jsonify(
        error=exc.message,
        code="UNKNOWN_PERMISSION",
        errors={"permissions": f"No existen en el catálogo: {', '.join(exc.codes)}"},
    ), 422


@rbac_bp.errorhandler(svc.RbacError)
def _rbac_error(exc: svc.RbacError):
    status, code = _ERRORS[type(exc)]
    return jsonify(error=exc.message, code=code), status


@rbac_bp.errorhandler(ValidationError)
def _validation_error(exc: ValidationError):
    return jsonify(error="Datos inválidos", code="VALIDATION_ERROR", errors=exc.errors), 422


@rbac_bp.errorhandler(InvalidJsonBody)
def _invalid_json(_exc):
    return jsonify(
        error="El cuerpo de la solicitud debe ser un objeto JSON", code="VALIDATION_ERROR", errors={}
    ), 422


def _q() -> str | None:
    return schemas.validate_query(request.args.get("q"))


def _group_detail(group_id: int):
    return schemas.group_detail(*svc.group_with_content(group_id))


def _role_detail(role, codes):
    return schemas.role_detail(role, codes)


# --- usuarios ---------------------------------------------------------------------------


@rbac_bp.get("/users")
@read_required
def list_users_route():
    return jsonify(svc.list_users(_q())), 200


@rbac_bp.get("/users/<int:user_id>")
@read_required
def get_user_route(user_id: int):
    return jsonify(schemas.user_detail(svc.get_user(user_id))), 200


@rbac_bp.get("/users/<int:user_id>/groups")
@read_required
def list_user_groups_route(user_id: int):
    return jsonify([schemas.group_brief(gr) for gr in svc.list_user_groups(user_id)]), 200


@rbac_bp.post("/users/<int:user_id>/groups")
@manage_required
def add_user_group_route(user_id: int):
    svc.get_user(user_id)
    group_id = schemas.validate_group_ref(json_body())
    return jsonify(svc.add_user_to_group(user_id, group_id, g.current_user)), 201


@rbac_bp.delete("/users/<int:user_id>/groups/<int:group_id>")
@manage_required
def remove_user_group_route(user_id: int, group_id: int):
    svc.remove_user_from_group(user_id, group_id, g.current_user)
    return "", 204


@rbac_bp.get("/users/<int:user_id>/roles")
@read_required
def list_direct_roles_route(user_id: int):
    return jsonify([schemas.direct_role_out(*row) for row in svc.list_direct_roles(user_id)]), 200


@rbac_bp.post("/users/<int:user_id>/roles")
@manage_required
def assign_direct_role_route(user_id: int):
    svc.get_user(user_id)
    data = schemas.validate_direct_role(json_body())
    row = svc.assign_direct_role(user_id, data["role_id"], data["reason"], g.current_user)
    return jsonify(schemas.direct_role_out(*row)), 201


@rbac_bp.delete("/users/<int:user_id>/roles/<int:role_id>")
@manage_required
def remove_direct_role_route(user_id: int, role_id: int):
    svc.remove_direct_role(user_id, role_id, g.current_user)
    return "", 204


@rbac_bp.get("/users/<int:user_id>/roles/<int:role_id>/removal-impact")
@read_required
def direct_role_removal_impact_route(user_id: int, role_id: int):
    return jsonify(svc.direct_role_removal_impact(user_id, role_id, g.current_user)), 200


@rbac_bp.get("/users/<int:user_id>/access")
@read_required
def user_access_route(user_id: int):
    return jsonify(svc.get_user_access(user_id)), 200


# --- grupos -----------------------------------------------------------------------------


@rbac_bp.get("/groups")
@read_required
def list_groups_route():
    return jsonify(svc.list_groups(_q())), 200


@rbac_bp.post("/groups")
@manage_required
def create_group_route():
    data = schemas.validate_name_description(json_body())
    group = svc.create_group(data["name"], data["description"], g.current_user)
    return jsonify(_group_detail(group.id)), 201


@rbac_bp.get("/groups/<int:group_id>")
@read_required
def get_group_route(group_id: int):
    return jsonify(_group_detail(group_id)), 200


@rbac_bp.put("/groups/<int:group_id>")
@manage_required
def update_group_route(group_id: int):
    svc.get_group(group_id)
    data = schemas.validate_name_description(json_body())
    svc.update_group(group_id, data["name"], data["description"], g.current_user)
    return jsonify(_group_detail(group_id)), 200


@rbac_bp.delete("/groups/<int:group_id>")
@manage_required
def delete_group_route(group_id: int):
    svc.delete_group(group_id, g.current_user)
    return "", 204


@rbac_bp.get("/groups/<int:group_id>/removal-impact")
@read_required
def group_deletion_impact_route(group_id: int):
    return jsonify(svc.group_deletion_impact(group_id, g.current_user)), 200


@rbac_bp.get("/groups/<int:group_id>/members")
@read_required
def list_group_members_route(group_id: int):
    return jsonify([schemas.member_out(u) for u in svc.list_group_members(group_id)]), 200


@rbac_bp.post("/groups/<int:group_id>/members")
@manage_required
def add_group_member_route(group_id: int):
    svc.get_group(group_id)
    user_id = schemas.validate_user_ref(json_body())
    svc.add_group_member(group_id, user_id, g.current_user)
    return jsonify(_group_detail(group_id)), 201


@rbac_bp.delete("/groups/<int:group_id>/members/<int:user_id>")
@manage_required
def remove_group_member_route(group_id: int, user_id: int):
    svc.remove_group_member(group_id, user_id, g.current_user)
    return "", 204


@rbac_bp.get("/groups/<int:group_id>/members/<int:user_id>/removal-impact")
@read_required
def member_removal_impact_route(group_id: int, user_id: int):
    return jsonify(svc.member_removal_impact(group_id, user_id, g.current_user)), 200


@rbac_bp.get("/groups/<int:group_id>/roles")
@read_required
def list_group_roles_route(group_id: int):
    return jsonify([schemas.role_brief(r) for r in svc.list_group_roles(group_id)]), 200


@rbac_bp.post("/groups/<int:group_id>/roles")
@manage_required
def add_group_role_route(group_id: int):
    svc.get_group(group_id)
    role_id = schemas.validate_role_ref(json_body())
    svc.add_group_role(group_id, role_id, g.current_user)
    return jsonify(_group_detail(group_id)), 201


@rbac_bp.delete("/groups/<int:group_id>/roles/<int:role_id>")
@manage_required
def remove_group_role_route(group_id: int, role_id: int):
    svc.remove_group_role(group_id, role_id, g.current_user)
    return "", 204


@rbac_bp.get("/groups/<int:group_id>/roles/<int:role_id>/removal-impact")
@read_required
def group_role_removal_impact_route(group_id: int, role_id: int):
    return jsonify(svc.group_role_removal_impact(group_id, role_id, g.current_user)), 200


# --- roles ------------------------------------------------------------------------------


@rbac_bp.get("/roles")
@read_required
def list_roles_route():
    return jsonify(svc.list_roles(_q())), 200


@rbac_bp.post("/roles")
@manage_required
def create_role_route():
    data = schemas.validate_name_description(json_body())
    role = svc.create_role(data["name"], data["description"], g.current_user)
    return jsonify(_role_detail(*svc.role_with_permissions(role.id))), 201


@rbac_bp.get("/roles/<int:role_id>")
@read_required
def get_role_route(role_id: int):
    return jsonify(_role_detail(*svc.role_with_permissions(role_id))), 200


@rbac_bp.put("/roles/<int:role_id>")
@manage_required
def update_role_route(role_id: int):
    svc.get_role(role_id)
    data = schemas.validate_name_description(json_body())
    svc.update_role(role_id, data["name"], data["description"], g.current_user)
    return jsonify(_role_detail(*svc.role_with_permissions(role_id))), 200


@rbac_bp.delete("/roles/<int:role_id>")
@manage_required
def delete_role_route(role_id: int):
    svc.delete_role(role_id, g.current_user)
    return "", 204


@rbac_bp.get("/roles/<int:role_id>/removal-impact")
@read_required
def role_deletion_impact_route(role_id: int):
    return jsonify(svc.role_deletion_impact(role_id, g.current_user)), 200


@rbac_bp.put("/roles/<int:role_id>/permissions")
@manage_required
def set_role_permissions_route(role_id: int):
    svc.get_role(role_id)
    codes = schemas.validate_permission_codes(json_body())
    svc.set_role_permissions(role_id, codes, g.current_user)
    return jsonify(_role_detail(*svc.role_with_permissions(role_id))), 200


@rbac_bp.post("/roles/<int:role_id>/permissions/impact")
@read_required
def permissions_change_impact_route(role_id: int):
    svc.get_role(role_id)
    codes = schemas.validate_permission_codes(json_body())
    return jsonify(svc.permissions_change_impact(role_id, codes, g.current_user)), 200


# --- catálogo ---------------------------------------------------------------------------


@rbac_bp.get("/permissions")
@read_required
def permission_catalog_route():
    return jsonify(svc.permission_catalog()), 200
