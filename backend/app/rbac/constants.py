"""Catálogo de permisos: FUENTE DE VERDAD en código (rbac-access-control, etapa 3).

Reglas:
- code = "recurso:acción", minúsculas, snake_case; recurso en inglés y plural, como en el endpoint.
- Acciones base read/create/update/delete; acciones de negocio solo con consecuencias distintas.
- Sin comodines (para "todo" existe users.is_superuser). Sin ownership.
- `code` es INMUTABLE: renombrar = permiso nuevo + migración de datos.
- Los permisos NO se crean por UI/API: se sincronizan a la tabla `permissions` con
  `python -m seeds.seed_rbac`.
- El nombre de cada miembro = code en mayúsculas con ":" -> "_" (espejo en
  frontend/src/features/security/permissions/perms.js).
"""

from enum import StrEnum


class Perm(StrEnum):
    ORDERS_READ = "orders:read"
    ORDERS_CREATE = "orders:create"
    ORDERS_UPDATE = "orders:update"
    ORDERS_DELETE = "orders:delete"
    ORDERS_QUOTE = "orders:quote"
    ORDERS_APPROVE = "orders:approve"
    ORDERS_PRODUCE = "orders:produce"
    ORDERS_DELIVER = "orders:deliver"

    CASH_MOVEMENTS_READ = "cash_movements:read"
    CASH_MOVEMENTS_CREATE = "cash_movements:create"

    CASH_CATEGORIES_READ = "cash_categories:read"
    CASH_CATEGORIES_CREATE = "cash_categories:create"
    CASH_CATEGORIES_UPDATE = "cash_categories:update"

    PRINTERS_READ = "printers:read"
    PRINTERS_CREATE = "printers:create"
    PRINTERS_UPDATE = "printers:update"

    SETTINGS_READ = "settings:read"
    SETTINGS_UPDATE = "settings:update"

    MATERIALS_READ = "materials:read"
    FILAMENTS_READ = "filaments:read"

    RBAC_READ = "rbac:read"
    RBAC_MANAGE = "rbac:manage"

    @property
    def resource(self) -> str:
        return self.value.split(":", 1)[0]

    @property
    def action(self) -> str:
        return self.value.split(":", 1)[1]


PERM_DESCRIPTIONS: dict[Perm, str] = {
    Perm.ORDERS_READ: "Ver pedidos, su detalle e historial de estados",
    Perm.ORDERS_CREATE: "Cargar pedidos nuevos (y clientes nuevos desde el alta)",
    Perm.ORDERS_UPDATE: "Editar las piezas y el cliente de un pedido",
    Perm.ORDERS_DELETE: "Eliminar pedidos definitivamente (en cualquier estado)",
    Perm.ORDERS_QUOTE: "Calcular y confirmar el presupuesto de un pedido (incluye elegir la impresora)",
    Perm.ORDERS_APPROVE: "Aprobar un pedido presupuestado y registrar la seña",
    Perm.ORDERS_PRODUCE: "Avanzar la producción: pasar a imprimiendo y a listo",
    Perm.ORDERS_DELIVER: "Entregar un pedido y cobrar el saldo",
    Perm.CASH_MOVEMENTS_READ: "Ver el saldo de caja, los movimientos y el saldo de cada pedido",
    Perm.CASH_MOVEMENTS_CREATE: "Registrar ingresos y egresos de caja, incluido el cobro de saldos",
    Perm.CASH_CATEGORIES_READ: "Ver las categorías de ingresos y egresos",
    Perm.CASH_CATEGORIES_CREATE: "Crear categorías de ingresos y egresos",
    Perm.CASH_CATEGORIES_UPDATE: "Editar y activar/desactivar categorías de ingresos y egresos",
    Perm.PRINTERS_READ: "Ver las impresoras del taller",
    Perm.PRINTERS_CREATE: "Dar de alta impresoras",
    Perm.PRINTERS_UPDATE: "Editar y activar/desactivar impresoras",
    Perm.SETTINGS_READ: "Ver la configuración del taller",
    Perm.SETTINGS_UPDATE: "Cambiar la configuración del taller (costos, margen, moneda, impresora por defecto)",
    Perm.MATERIALS_READ: "Ver el catálogo de materiales",
    Perm.FILAMENTS_READ: "Ver el catálogo de tipos de filamento",
    Perm.RBAC_READ: "Ver usuarios, grupos, roles, permisos y accesos",
    Perm.RBAC_MANAGE: "Administrar grupos, roles y asignaciones de acceso",
}

# Orden = orden de presentación del catálogo (GET /api/rbac/permissions).
RESOURCE_LABELS: dict[str, str] = {
    "orders": "Pedidos",
    "cash_movements": "Movimientos de caja",
    "cash_categories": "Categorías de caja",
    "printers": "Impresoras",
    "settings": "Configuración del taller",
    "materials": "Materiales",
    "filaments": "Filamentos",
    "rbac": "Seguridad",
}

# Bootstrap del seed (P1 + E3-2/E3-4). Lista EXPLÍCITA: un permiso nuevo NO se suma solo.
OPERATOR_ROLE_NAME = "Operador"
OPERATOR_ROLE_DESCRIPTION = "Operación diaria del taller: pedidos y caja, sin configuración ni seguridad"
OPERATOR_GROUP_NAME = "Operadores"
OPERATOR_GROUP_DESCRIPTION = "Operadores del taller"

OPERATOR_ROLE_PERMS: frozenset[Perm] = frozenset(
    {
        Perm.ORDERS_READ,
        Perm.ORDERS_CREATE,
        Perm.ORDERS_UPDATE,
        Perm.ORDERS_QUOTE,
        Perm.ORDERS_APPROVE,
        Perm.ORDERS_PRODUCE,
        Perm.ORDERS_DELIVER,
        Perm.CASH_MOVEMENTS_READ,
        Perm.CASH_MOVEMENTS_CREATE,
        Perm.CASH_CATEGORIES_READ,
        Perm.PRINTERS_READ,
        Perm.SETTINGS_READ,
        Perm.MATERIALS_READ,
        Perm.FILAMENTS_READ,
    }
)
