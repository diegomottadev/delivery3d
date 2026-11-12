import { renderHook, act, waitFor } from '@testing-library/react';
import { usePermissions } from './PermissionsContext';
import { useAuth } from '../../auth/AuthContext';
import * as securityApi from '../securityApi';
import * as authApi from '../../auth/authApi';
import { PERM } from './perms';
import { AllProviders, startSession, mockMyPermissions, mockMyPermissionsError } from './permissionsTestUtils';

jest.mock('../securityApi');
jest.mock('../../auth/authApi');

const renderPerms = () => renderHook(() => ({ perms: usePermissions(), auth: useAuth() }), { wrapper: AllProviders });

describe('PermissionsProvider / usePermissions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    test('sin sesión no consulta la API y can() es false', () => {
        const { result } = renderPerms();
        expect(securityApi.getMyPermissions).not.toHaveBeenCalled();
        expect(result.current.perms.status).toBe('idle');
        expect(result.current.perms.can(PERM.RBAC_READ)).toBe(false);
    });

    test('con sesión arranca en loading y can() es false hasta que llega la respuesta', async () => {
        startSession();
        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        const { result } = renderPerms();
        expect(result.current.perms.status).toBe('loading');
        expect(result.current.perms.can(PERM.RBAC_READ)).toBe(false);
        await waitFor(() => expect(result.current.perms.status).toBe('ready'));
    });

    test('carga /me/permissions y can() responde según la lista', async () => {
        startSession();
        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        const { result } = renderPerms();
        await waitFor(() => expect(result.current.perms.status).toBe('ready'));
        expect(securityApi.getMyPermissions).toHaveBeenCalledTimes(1);
        expect(result.current.perms.can(PERM.RBAC_READ)).toBe(true);
        expect(result.current.perms.can(PERM.RBAC_MANAGE)).toBe(false);
        expect(result.current.perms.isSuperuser).toBe(false);
    });

    test('expone el userId de /me/permissions (para detectar acciones sobre uno mismo) y lo limpia al salir', async () => {
        startSession();
        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        const { result } = renderPerms();
        expect(result.current.perms.userId).toBeNull();
        await waitFor(() => expect(result.current.perms.userId).toBe(1));
        act(() => {
            result.current.auth.logout();
        });
        expect(result.current.perms.userId).toBeNull();
    });

    test('canAny es true si tiene al menos uno, false si ninguno o sin argumentos', async () => {
        startSession();
        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        const { result } = renderPerms();
        await waitFor(() => expect(result.current.perms.status).toBe('ready'));
        expect(result.current.perms.canAny(PERM.RBAC_MANAGE, PERM.RBAC_READ)).toBe(true);
        expect(result.current.perms.canAny(PERM.RBAC_MANAGE)).toBe(false);
        expect(result.current.perms.canAny()).toBe(false);
    });

    test('is_superuser → can() y canAny() devuelven true para cualquier permiso', async () => {
        startSession();
        mockMyPermissions({ permissions: [], isSuperuser: true });
        const { result } = renderPerms();
        await waitFor(() => expect(result.current.perms.status).toBe('ready'));
        expect(result.current.perms.isSuperuser).toBe(true);
        expect(result.current.perms.can(PERM.RBAC_MANAGE)).toBe(true);
        expect(result.current.perms.canAny(PERM.RBAC_READ)).toBe(true);
    });

    test('si la carga falla queda cerrado (status error, can false) y refresh() reintenta', async () => {
        startSession();
        mockMyPermissionsError();
        const { result } = renderPerms();
        await waitFor(() => expect(result.current.perms.status).toBe('error'));
        expect(result.current.perms.can(PERM.RBAC_READ)).toBe(false);

        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        await act(async () => {
            await result.current.perms.refresh();
        });
        expect(result.current.perms.status).toBe('ready');
        expect(result.current.perms.can(PERM.RBAC_READ)).toBe(true);
    });

    test('refresh() vuelve a consultar y aplica los permisos nuevos', async () => {
        startSession();
        mockMyPermissions({ permissions: [PERM.RBAC_READ, PERM.RBAC_MANAGE] });
        const { result } = renderPerms();
        await waitFor(() => expect(result.current.perms.can(PERM.RBAC_MANAGE)).toBe(true));

        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        await act(async () => {
            await result.current.perms.refresh();
        });
        expect(securityApi.getMyPermissions).toHaveBeenCalledTimes(2);
        expect(result.current.perms.can(PERM.RBAC_MANAGE)).toBe(false);
    });

    test('refresh() con permisos ya cargados no vuelve a loading (no desmonta pantallas)', async () => {
        startSession();
        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        const { result } = renderPerms();
        await waitFor(() => expect(result.current.perms.status).toBe('ready'));

        let resolveRefresh;
        securityApi.getMyPermissions.mockReturnValue(new Promise((r) => (resolveRefresh = r)));
        let pending;
        act(() => {
            pending = result.current.perms.refresh();
        });
        expect(result.current.perms.status).toBe('ready');
        await act(async () => {
            resolveRefresh({ user_id: 1, is_superuser: false, permissions: [] });
            await pending;
        });
        expect(result.current.perms.can(PERM.RBAC_READ)).toBe(false);
    });

    test('logout limpia los permisos y un nuevo login los vuelve a cargar', async () => {
        startSession();
        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        const { result } = renderPerms();
        await waitFor(() => expect(result.current.perms.can(PERM.RBAC_READ)).toBe(true));

        act(() => {
            result.current.auth.logout();
        });
        expect(result.current.perms.status).toBe('idle');
        expect(result.current.perms.can(PERM.RBAC_READ)).toBe(false);

        authApi.login.mockResolvedValue({ token: 'otro-token', user: { id: 2, username: 'admin' } });
        mockMyPermissions({ permissions: [PERM.RBAC_MANAGE] });
        await act(async () => {
            await result.current.auth.login('admin', 'secreto');
        });
        await waitFor(() => expect(result.current.perms.status).toBe('ready'));
        expect(securityApi.getMyPermissions).toHaveBeenCalledTimes(2);
        expect(result.current.perms.can(PERM.RBAC_MANAGE)).toBe(true);
        expect(result.current.perms.can(PERM.RBAC_READ)).toBe(false);
    });

    test('ignora la respuesta de una sesión anterior si el token cambió mientras cargaba', async () => {
        startSession();
        let resolveOld;
        securityApi.getMyPermissions.mockReturnValueOnce(new Promise((r) => (resolveOld = r)));
        const { result } = renderPerms();

        act(() => {
            result.current.auth.logout();
        });
        await act(async () => {
            resolveOld({ user_id: 1, is_superuser: true, permissions: [] });
        });
        expect(result.current.perms.status).toBe('idle');
        expect(result.current.perms.can(PERM.RBAC_MANAGE)).toBe(false);
    });

    test('no persiste permisos en localStorage', async () => {
        startSession();
        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        const { result } = renderPerms();
        await waitFor(() => expect(result.current.perms.status).toBe('ready'));
        expect(Object.keys(localStorage).sort()).toEqual(['token', 'user']);
    });

    test('en desarrollo avisa si se consulta un permiso que no está en PERM (string suelto)', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        startSession();
        mockMyPermissions({ permissions: [] });
        const { result } = renderPerms();
        await waitFor(() => expect(result.current.perms.status).toBe('ready'));
        expect(result.current.perms.can('rbac:typo')).toBe(false);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('rbac:typo'));
        warn.mockRestore();
    });

    test('usePermissions fuera del provider lanza un error claro', () => {
        const err = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => usePermissions())).toThrow(/PermissionsProvider/);
        err.mockRestore();
    });
});
