import { PERM, ALL_PERMS, isKnownPerm } from './perms';

// Copia literal del enum Perm de backend/app/rbac/constants.py (etapa 3, 22 miembros).
const BACKEND_PERM = {
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
};

describe('PERM (espejo del enum Perm del backend)', () => {
    test('coincide 1 a 1 con el enum Perm del backend (22 miembros, mismos nombres y codes)', () => {
        expect({ ...PERM }).toEqual(BACKEND_PERM);
        expect(ALL_PERMS).toHaveLength(22);
    });

    test('el nombre de cada miembro es el code en mayúsculas con ":" → "_"', () => {
        Object.entries(PERM).forEach(([name, code]) => {
            expect(name).toBe(code.toUpperCase().replace(':', '_'));
        });
    });

    test('incluye los permisos de la sección Seguridad', () => {
        expect(PERM.RBAC_READ).toBe('rbac:read');
        expect(PERM.RBAC_MANAGE).toBe('rbac:manage');
    });

    test('está congelado: no se pueden agregar ni pisar permisos en runtime', () => {
        expect(Object.isFrozen(PERM)).toBe(true);
        expect(Object.isFrozen(ALL_PERMS)).toBe(true);
    });

    test('todos los codes tienen el formato "recurso:acción" con un solo ":"', () => {
        ALL_PERMS.forEach((code) => {
            expect(code).toMatch(/^[a-z][a-z_]*:[a-z][a-z_]*$/);
        });
    });

    test('no hay codes duplicados', () => {
        expect(new Set(ALL_PERMS).size).toBe(ALL_PERMS.length);
    });

    test('isKnownPerm distingue codes del enum de strings sueltos', () => {
        expect(isKnownPerm(PERM.RBAC_READ)).toBe(true);
        expect(isKnownPerm('rbac:users:read')).toBe(false);
        expect(isKnownPerm(undefined)).toBe(false);
    });
});
