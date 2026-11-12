import { renderHook, waitFor, act } from '@testing-library/react';
import { useApiErrorHandler } from './useApiErrorHandler';
import * as securityApi from './securityApi';
import { AllProviders, startSession, mockMyPermissions } from './permissions/permissionsTestUtils';

jest.mock('./securityApi');
jest.mock('../auth/authApi');

// Deja resolver las promesas mockeadas de /me/permissions dentro de act.
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

const axiosError = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

describe('useApiErrorHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        startSession();
        mockMyPermissions({ permissions: ['rbac:read'] });
    });

    const setup = async () => {
        const utils = renderHook(() => useApiErrorHandler(), { wrapper: AllProviders });
        await waitFor(() => expect(securityApi.getMyPermissions).toHaveBeenCalledTimes(1));
        await flush();
        return utils;
    };

    test('ante un 403 devuelve el error normalizado y refresca /me/permissions', async () => {
        const { result } = await setup();
        let apiError;
        await act(async () => {
            apiError = result.current(axiosError(403, { error: 'Acceso denegado: permisos insuficientes', code: 'FORBIDDEN' }));
        });
        expect(apiError.isForbidden).toBe(true);
        await waitFor(() => expect(securityApi.getMyPermissions).toHaveBeenCalledTimes(2));
        await flush();
    });

    test('un 409 de negocio (SELF_ASSIGNMENT) no refresca permisos', async () => {
        const { result } = await setup();
        let apiError;
        await act(async () => {
            apiError = result.current(axiosError(409, { error: 'No podés asignarte roles', code: 'SELF_ASSIGNMENT' }));
        });
        expect(apiError.code).toBe('SELF_ASSIGNMENT');
        expect(securityApi.getMyPermissions).toHaveBeenCalledTimes(1);
    });
});
