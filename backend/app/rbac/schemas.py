"""Validación de bodies y serialización del blueprint /api/rbac (etapa 6).

Validación a mano (sin dependencias nuevas): cada `validate_*` devuelve un dict limpio o
lanza `ValidationError(errors)`. Los campos de auditoría (`created_by`, `assigned_by`, …) y
`is_superuser` NUNCA se leen del body: se ignoran.
"""

from datetime import datetime

NAME_MAX = 100
DESCRIPTION_MAX = 255
REASON_MAX = 255
QUERY_MAX = 100


class ValidationError(Exception):
    def __init__(self, errors: dict[str, str]):
        self.errors = errors
        super().__init__(str(errors))


def _required_id(payload: dict, field: str, errors: dict[str, str]) -> int | None:
    value = payload.get(field)
    # bool es subclase de int: se rechaza explícitamente.
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        errors[field] = f"{field} es obligatorio y debe ser un entero positivo"
        return None
    return value


def validate_name_description(payload: dict) -> dict:
    """Body de POST/PUT de grupos y roles. PUT es reemplazo completo: sin description -> null."""
    errors: dict[str, str] = {}

    name = payload.get("name")
    if not isinstance(name, str) or not name.strip():
        errors["name"] = "El nombre es obligatorio"
    elif len(name.strip()) > NAME_MAX:
        errors["name"] = f"El nombre admite hasta {NAME_MAX} caracteres"

    description = payload.get("description")
    if description is not None and not isinstance(description, str):
        errors["description"] = "La descripción debe ser texto"
    elif isinstance(description, str) and len(description.strip()) > DESCRIPTION_MAX:
        errors["description"] = f"La descripción admite hasta {DESCRIPTION_MAX} caracteres"

    if errors:
        raise ValidationError(errors)
    return {"name": name.strip(), "description": (description or "").strip() or None}


def validate_user_ref(payload: dict) -> int:
    errors: dict[str, str] = {}
    user_id = _required_id(payload, "user_id", errors)
    if errors:
        raise ValidationError(errors)
    return user_id


def validate_group_ref(payload: dict) -> int:
    errors: dict[str, str] = {}
    group_id = _required_id(payload, "group_id", errors)
    if errors:
        raise ValidationError(errors)
    return group_id


def validate_role_ref(payload: dict) -> int:
    errors: dict[str, str] = {}
    role_id = _required_id(payload, "role_id", errors)
    if errors:
        raise ValidationError(errors)
    return role_id


def validate_direct_role(payload: dict) -> dict:
    errors: dict[str, str] = {}
    role_id = _required_id(payload, "role_id", errors)

    reason = payload.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        errors["reason"] = "El motivo es obligatorio"
    elif len(reason.strip()) > REASON_MAX:
        errors["reason"] = f"El motivo admite hasta {REASON_MAX} caracteres"

    if errors:
        raise ValidationError(errors)
    return {"role_id": role_id, "reason": reason.strip()}


def validate_permission_codes(payload: dict) -> list[str]:
    """Lista de codes (sin duplicados, en el orden recibido). La pertenencia al catálogo la
    resuelve el service (UNKNOWN_PERMISSION)."""
    codes = payload.get("permissions")
    if not isinstance(codes, list) or not all(isinstance(c, str) for c in codes):
        raise ValidationError({"permissions": "permissions debe ser una lista de códigos de permiso"})
    return list(dict.fromkeys(c.strip() for c in codes))


def validate_query(raw: str | None) -> str | None:
    q = (raw or "").strip()
    if len(q) > QUERY_MAX:
        raise ValidationError({"q": f"La búsqueda admite hasta {QUERY_MAX} caracteres"})
    return q or None


# --- serialización ----------------------------------------------------------------------


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def user_ref(user) -> dict | None:
    return None if user is None else {"id": user.id, "username": user.username}


def member_out(user) -> dict:
    return {"id": user.id, "username": user.username, "is_active": user.is_active}


def role_brief(role) -> dict:
    return {"id": role.id, "name": role.name, "description": role.description}


def group_brief(group) -> dict:
    return {"id": group.id, "name": group.name, "description": group.description}


def ref(entity) -> dict:
    return {"id": entity.id, "name": entity.name}


def group_detail(group, members, roles) -> dict:
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "created_at": iso(group.created_at),
        "updated_at": iso(group.updated_at),
        "members": [member_out(u) for u in members],
        "roles": [role_brief(r) for r in roles],
    }


def role_detail(role, permission_codes) -> dict:
    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "created_at": iso(role.created_at),
        "updated_at": iso(role.updated_at),
        "permissions": sorted(permission_codes),
    }


def user_detail(user) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "created_at": iso(user.created_at),
        "updated_at": iso(user.updated_at),
    }


def direct_role_out(assignment, role, assigned_by) -> dict:
    return {
        "id": assignment.id,
        "role": ref(role),
        "reason": assignment.reason,
        "assigned_by": user_ref(assigned_by),
        "assigned_at": iso(assignment.assigned_at),
    }
