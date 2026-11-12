/**
 * Espejo del enum `Perm` de backend/app/rbac/constants.py (22 miembros).
 * Formato "recurso:acción" (un solo ":"); nombre del miembro = code en mayúsculas con ":" → "_".
 * Una entrada por línea: el test de sincronía del backend parsea este archivo.
 * Usar SIEMPRE `PERM.X` en can(), <Can>, <RequirePermission> y menuConfig: nunca strings sueltos.
 *
 * Ocultar en el front es solo UX: la autorización real la hace el backend.
 */
export const PERM = Object.freeze({
    ORDERS_READ: 'orders:read',
    ORDERS_CREATE: 'orders:create',
    ORDERS_UPDATE: 'orders:update',
    ORDERS_DELETE: 'orders:delete',
    ORDERS_QUOTE: 'orders:quote',
    ORDERS_APPROVE: 'orders:approve',
    ORDERS_PRODUCE: 'orders:produce',
    ORDERS_DELIVER: 'orders:deliver',
    CASH_MOVEMENTS_READ: 'cash_movements:read',
    CASH_MOVEMENTS_CREATE: 'cash_movements:create',
    CASH_CATEGORIES_READ: 'cash_categories:read',
    CASH_CATEGORIES_CREATE: 'cash_categories:create',
    CASH_CATEGORIES_UPDATE: 'cash_categories:update',
    PRINTERS_READ: 'printers:read',
    PRINTERS_CREATE: 'printers:create',
    PRINTERS_UPDATE: 'printers:update',
    SETTINGS_READ: 'settings:read',
    SETTINGS_UPDATE: 'settings:update',
    MATERIALS_READ: 'materials:read',
    FILAMENTS_READ: 'filaments:read',
    RBAC_READ: 'rbac:read',
    RBAC_MANAGE: 'rbac:manage',
});

/** @typedef {typeof PERM[keyof typeof PERM]} PermCode */

/** @type {ReadonlyArray<PermCode>} */
export const ALL_PERMS = Object.freeze(Object.values(PERM));

const KNOWN = new Set(ALL_PERMS);

/** @param {unknown} code */
export const isKnownPerm = (code) => KNOWN.has(code);
