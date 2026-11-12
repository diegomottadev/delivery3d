import { PERM, ALL_PERMS, isKnownPerm } from './perms';

describe('PERM (espejo del enum Perm del backend)', () => {
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
