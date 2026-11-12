/**
 * Espejo del enum `Perm` del backend. Formato "recurso:acción" (un solo ":").
 * Usar SIEMPRE `PERM.X` en can(), <Can>, <RequirePermission> y menuConfig: nunca strings sueltos.
 *
 * Ocultar en el front es solo UX: la autorización real la hace el backend.
 *
 * @typedef {'rbac:read'|'rbac:manage'|'orders:read'} PermCode
 */
export const PERM = Object.freeze({
    RBAC_READ: 'rbac:read',
    RBAC_MANAGE: 'rbac:manage',
    // TODO(rbac etapa 3): tentativo, se sincroniza con el catálogo final del enum Perm del backend.
    ORDERS_READ: 'orders:read',
});

/** @type {ReadonlyArray<PermCode>} */
export const ALL_PERMS = Object.freeze(Object.values(PERM));

const KNOWN = new Set(ALL_PERMS);

/** @param {unknown} code */
export const isKnownPerm = (code) => KNOWN.has(code);
