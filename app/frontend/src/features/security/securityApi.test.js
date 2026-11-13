import axios from 'axios';
import { getMyPermissions } from './securityApi';

jest.mock('axios');

describe('securityApi.getMyPermissions', () => {
    const payload = { user_id: 1, is_superuser: false, permissions: ['orders:read', 'rbac:read'] };

    beforeEach(() => {
        localStorage.clear();
        axios.get.mockResolvedValue({ data: payload });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('llama a GET /api/auth/me/permissions y devuelve el body', async () => {
        await expect(getMyPermissions()).resolves.toEqual(payload);
        expect(axios.get.mock.calls[0][0]).toBe('/api/auth/me/permissions');
    });

    test('envía el token de la sesión (leído en cada request, nunca embebido)', async () => {
        localStorage.setItem('token', 'token-de-sesion');
        await getMyPermissions();
        expect(axios.get.mock.calls[0][1].headers.Authorization).toBe('Bearer token-de-sesion');
    });

    test('sin sesión no envía Authorization', async () => {
        await getMyPermissions();
        expect(axios.get.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });

    test('propaga el error de la API (ej. 401)', async () => {
        const error = Object.assign(new Error('401'), { response: { status: 401 } });
        axios.get.mockRejectedValueOnce(error);
        await expect(getMyPermissions()).rejects.toBe(error);
    });
});

describe('securityApi: endpoints /api/rbac/* (api-contract.md §2-§6)', () => {
    const api = require('./securityApi');

    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem('token', 'tk');
        ['get', 'post', 'put', 'delete'].forEach((m) => axios[m].mockResolvedValue({ data: { ok: m } }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // [función, args, método, url, body esperado (solo post/put)]
    const CASES = [
        ['listUsers', [], 'get', '/api/rbac/users'],
        ['getUser', [7], 'get', '/api/rbac/users/7'],
        ['listUserGroups', [7], 'get', '/api/rbac/users/7/groups'],
        ['addUserToGroup', [7, 3], 'post', '/api/rbac/users/7/groups', { group_id: 3 }],
        ['removeUserFromGroup', [7, 3], 'delete', '/api/rbac/users/7/groups/3'],
        ['listUserDirectRoles', [7], 'get', '/api/rbac/users/7/roles'],
        ['assignDirectRole', [7, 5, 'Cubre auditoría'], 'post', '/api/rbac/users/7/roles', { role_id: 5, reason: 'Cubre auditoría' }],
        ['removeDirectRole', [7, 5], 'delete', '/api/rbac/users/7/roles/5'],
        ['getUserAccess', [7], 'get', '/api/rbac/users/7/access'],
        ['listGroups', [], 'get', '/api/rbac/groups'],
        ['createGroup', [{ name: 'Operadores', description: 'd' }], 'post', '/api/rbac/groups', { name: 'Operadores', description: 'd' }],
        ['getGroup', [3], 'get', '/api/rbac/groups/3'],
        ['updateGroup', [3, { name: 'Ops', description: null }], 'put', '/api/rbac/groups/3', { name: 'Ops', description: null }],
        ['deleteGroup', [3], 'delete', '/api/rbac/groups/3'],
        ['listGroupMembers', [3], 'get', '/api/rbac/groups/3/members'],
        ['addGroupMember', [3, 7], 'post', '/api/rbac/groups/3/members', { user_id: 7 }],
        ['removeGroupMember', [3, 7], 'delete', '/api/rbac/groups/3/members/7'],
        ['listGroupRoles', [3], 'get', '/api/rbac/groups/3/roles'],
        ['addGroupRole', [3, 2], 'post', '/api/rbac/groups/3/roles', { role_id: 2 }],
        ['removeGroupRole', [3, 2], 'delete', '/api/rbac/groups/3/roles/2'],
        ['listRoles', [], 'get', '/api/rbac/roles'],
        ['createRole', [{ name: 'Operador', description: 'd' }], 'post', '/api/rbac/roles', { name: 'Operador', description: 'd' }],
        ['getRole', [2], 'get', '/api/rbac/roles/2'],
        ['updateRole', [2, { name: 'Op', description: 'd' }], 'put', '/api/rbac/roles/2', { name: 'Op', description: 'd' }],
        ['deleteRole', [2], 'delete', '/api/rbac/roles/2'],
        ['setRolePermissions', [2, ['orders:read']], 'put', '/api/rbac/roles/2/permissions', { permissions: ['orders:read'] }],
        ['listPermissionCatalog', [], 'get', '/api/rbac/permissions'],
        ['getGroupRoleRemovalImpact', [3, 2], 'get', '/api/rbac/groups/3/roles/2/removal-impact'],
        ['getGroupMemberRemovalImpact', [3, 7], 'get', '/api/rbac/groups/3/members/7/removal-impact'],
        ['getDirectRoleRemovalImpact', [7, 5], 'get', '/api/rbac/users/7/roles/5/removal-impact'],
        ['getGroupRemovalImpact', [3], 'get', '/api/rbac/groups/3/removal-impact'],
        ['getRoleRemovalImpact', [2], 'get', '/api/rbac/roles/2/removal-impact'],
        ['previewRolePermissionsImpact', [2, ['rbac:read']], 'post', '/api/rbac/roles/2/permissions/impact', { permissions: ['rbac:read'] }],
    ];

    // Filas de largo fijo: si faltan valores, jest-each pasa `done` como último argumento.
    const ROWS = CASES.map(([fn, args, method, url, body = null]) => [fn, args, method, url, body]);

    test.each(ROWS)('%s → %s %s', async (fn, args, method, url, body) => {
        await expect(api[fn](...args)).resolves.toEqual({ ok: method });
        const [sentUrl, second, third] = axios[method].mock.calls[0];
        const hasBody = method === 'post' || method === 'put';
        const config = hasBody ? third : second;
        expect(sentUrl).toBe(url);
        expect(hasBody ? second : null).toEqual(body);
        expect(config.headers.Authorization).toBe('Bearer tk');
    });

    test('listUsers / listGroups / listRoles envían q como query param solo si viene', async () => {
        await api.listUsers('ana');
        expect(axios.get.mock.calls[0][1].params).toEqual({ q: 'ana' });
        await api.listGroups();
        expect(axios.get.mock.calls[1][1].params).toEqual({});
        await api.listRoles('  ');
        expect(axios.get.mock.calls[2][1].params).toEqual({});
    });

    test('createGroup/updateRole solo envían campos permitidos (sin mass assignment)', async () => {
        await api.createGroup({ name: 'G', description: 'd', id: 99, is_superuser: true });
        expect(axios.post.mock.calls[0][1]).toEqual({ name: 'G', description: 'd' });
        await api.updateRole(2, { name: 'R', description: 'd', permissions: ['rbac:manage'] });
        expect(axios.put.mock.calls[0][1]).toEqual({ name: 'R', description: 'd' });
    });

    test('rechaza ids no enteros antes de armar la URL (no hay path traversal)', () => {
        expect(() => api.getUser('../auth/me')).toThrow(/id inválido/i);
        expect(() => api.removeGroupRole(3, '2/x')).toThrow(/id inválido/i);
        expect(axios.get).not.toHaveBeenCalled();
        expect(axios.delete).not.toHaveBeenCalled();
    });
});
