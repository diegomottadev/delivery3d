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
