import axios from 'axios';
import { listOrders } from '../orders/ordersApi';
import { getCashSummary } from '../cashbox/cashboxApi';
import { getMe } from './authApi';

jest.mock('axios');

describe('auth headers (OWASP A07: sin token embebido)', () => {
    beforeEach(() => {
        localStorage.clear();
        axios.get.mockResolvedValue({ data: [] });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('ordersApi no envía Authorization si no hay sesión', async () => {
        await listOrders();
        const config = axios.get.mock.calls[0][1];
        expect(config.headers.Authorization).toBeUndefined();
    });

    test('ordersApi envía el token de la sesión', async () => {
        localStorage.setItem('token', 'token-de-sesion');
        await listOrders();
        const config = axios.get.mock.calls[0][1];
        expect(config.headers.Authorization).toBe('Bearer token-de-sesion');
    });

    test('cashboxApi no envía Authorization si no hay sesión', async () => {
        await getCashSummary();
        const config = axios.get.mock.calls[0][1];
        expect(config.headers.Authorization).toBeUndefined();
    });

    test('getMe devuelve el usuario tal como lo responde /api/auth/me', async () => {
        const user = { id: 1, username: 'operador', role: 'admin' };
        axios.get.mockResolvedValueOnce({ data: user });
        await expect(getMe('t')).resolves.toEqual(user);
    });
});
