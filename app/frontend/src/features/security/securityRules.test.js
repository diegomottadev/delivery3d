import { PERM } from './permissions/perms';
import {
    parseUtc,
    formatUtcDateTime,
    myRoleIds,
    wouldLoseManage,
    viaGroup,
    viaRole,
    viaGroupRole,
    viaDirectRole,
    describeSource,
    describeMutationError,
} from './securityRules';

const MY_ACCESS = {
    user_id: 1,
    is_superuser: false,
    roles: [
        { role: { id: 2, name: 'Operador' }, sources: [{ type: 'group', group: { id: 3, name: 'Operadores' } }] },
        { role: { id: 9, name: 'Admin seguridad' }, sources: [{ type: 'group', group: { id: 4, name: 'Seguridad' } }] },
    ],
    permissions: [
        { code: PERM.ORDERS_READ, sources: [{ type: 'group', group: { id: 3, name: 'Operadores' }, role: { id: 2, name: 'Operador' } }] },
        { code: PERM.RBAC_MANAGE, sources: [{ type: 'group', group: { id: 4, name: 'Seguridad' }, role: { id: 9, name: 'Admin seguridad' } }] },
    ],
};

describe('fechas UTC sin sufijo de zona', () => {
    test('parseUtc interpreta el ISO sin zona como UTC (no como hora local)', () => {
        expect(parseUtc('2026-11-10T14:03:00').getTime()).toBe(Date.UTC(2026, 10, 10, 14, 3, 0));
    });

    test('parseUtc respeta un sufijo de zona explícito', () => {
        expect(parseUtc('2026-11-10T14:03:00Z').getTime()).toBe(Date.UTC(2026, 10, 10, 14, 3, 0));
        expect(parseUtc('2026-11-10T14:03:00+00:00').getTime()).toBe(Date.UTC(2026, 10, 10, 14, 3, 0));
    });

    test('formatUtcDateTime muestra la hora local equivalente; vacío o inválido → guion', () => {
        const expected = new Date(Date.UTC(2026, 10, 10, 14, 3, 0)).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
        expect(formatUtcDateTime('2026-11-10T14:03:00')).toBe(expected);
        expect(formatUtcDateTime(null)).toBe('—');
        expect(formatUtcDateTime('no-es-fecha')).toBe('—');
    });
});

describe('reglas de auto-asignación y auto-bloqueo', () => {
    test('myRoleIds junta los roles que tengo por cualquier vía', () => {
        expect([...myRoleIds(MY_ACCESS)].sort()).toEqual([2, 9]);
        expect(myRoleIds(null).size).toBe(0);
    });

    test('wouldLoseManage es true solo si TODAS las fuentes de rbac:manage se pierden', () => {
        expect(wouldLoseManage(MY_ACCESS, viaGroup(4))).toBe(true);
        expect(wouldLoseManage(MY_ACCESS, viaGroup(3))).toBe(false);
        expect(wouldLoseManage(MY_ACCESS, viaRole(9))).toBe(true);
        expect(wouldLoseManage(MY_ACCESS, viaGroupRole(4, 9))).toBe(true);
        expect(wouldLoseManage(MY_ACCESS, viaGroupRole(4, 2))).toBe(false);
        expect(wouldLoseManage(MY_ACCESS, viaDirectRole(9))).toBe(false);
    });

    test('con otra fuente de rbac:manage (directo) no hay auto-bloqueo', () => {
        const access = {
            ...MY_ACCESS,
            permissions: [
                {
                    code: PERM.RBAC_MANAGE,
                    sources: [
                        { type: 'group', group: { id: 4, name: 'Seguridad' }, role: { id: 9, name: 'Admin seguridad' } },
                        { type: 'direct', role: { id: 9, name: 'Admin seguridad' } },
                    ],
                },
            ],
        };
        expect(wouldLoseManage(access, viaGroup(4))).toBe(false);
        expect(wouldLoseManage(access, viaRole(9))).toBe(true);
    });

    test('superusuario, sin acceso cargado o sin rbac:manage → nunca bloquea', () => {
        expect(wouldLoseManage({ ...MY_ACCESS, is_superuser: true }, viaGroup(4))).toBe(false);
        expect(wouldLoseManage(null, viaGroup(4))).toBe(false);
        expect(wouldLoseManage({ ...MY_ACCESS, permissions: [] }, viaGroup(4))).toBe(false);
    });
});

describe('describeSource (origen de un permiso)', () => {
    test('vía grupo, directo y superusuario', () => {
        expect(describeSource({ type: 'group', group: { id: 3, name: 'Operadores' }, role: { id: 2, name: 'Operador' } })).toBe(
            'vía grupo Operadores → rol Operador'
        );
        expect(describeSource({ type: 'direct', role: { id: 5, name: 'Auditor' } })).toBe('directo → rol Auditor');
        expect(describeSource({ type: 'superuser' })).toBe('superusuario');
    });
});

describe('describeMutationError', () => {
    const apiError = (overrides) => ({ status: 409, code: null, message: 'x', fieldErrors: {}, isForbidden: false, isUnauthorized: false, ...overrides });

    test('409 → mensaje del backend con el code', () => {
        const { summary, detail } = describeMutationError(apiError({ code: 'SELF_LOCKOUT', message: 'No podés quitarte a vos mismo el permiso' }));
        expect(summary).toMatch(/auto-bloqueo|bloque/i);
        expect(detail).toBe('No podés quitarte a vos mismo el permiso (SELF_LOCKOUT)');
    });

    test('409 sin mensaje del backend usa uno propio claro', () => {
        const { detail } = describeMutationError(apiError({ code: 'ROLE_IN_USE', message: 'Ocurrió un error inesperado. Intentá de nuevo más tarde.', backendMessage: null }));
        expect(detail).toMatch(/ROLE_IN_USE/);
    });

    test('403 → no tenés permiso', () => {
        const { detail } = describeMutationError(apiError({ status: 403, code: 'FORBIDDEN', isForbidden: true }));
        expect(detail).toMatch(/No tenés permiso para realizar esta acción/);
    });

    test('422 → junta los errores por campo', () => {
        const { detail } = describeMutationError(apiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Datos inválidos', fieldErrors: { reason: 'El motivo es obligatorio' } }));
        expect(detail).toMatch(/El motivo es obligatorio/);
    });
});
