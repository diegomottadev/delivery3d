import { getApiError } from './apiError';

const axiosError = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

describe('getApiError', () => {
    test('403 FORBIDDEN del backend → isForbidden con el mensaje del backend', () => {
        const e = getApiError(axiosError(403, { error: 'Acceso denegado: permisos insuficientes', code: 'FORBIDDEN' }));
        expect(e).toMatchObject({ status: 403, code: 'FORBIDDEN', isForbidden: true, message: 'Acceso denegado: permisos insuficientes' });
    });

    test('403 sin code (roles_required legado) igual se trata como FORBIDDEN', () => {
        const e = getApiError(axiosError(403, {}));
        expect(e.isForbidden).toBe(true);
        expect(e.code).toBe('FORBIDDEN');
        expect(e.message).toMatch(/permisos insuficientes/i);
    });

    test('409 con code de negocio (SELF_LOCKOUT) conserva code y mensaje, no es forbidden', () => {
        const e = getApiError(axiosError(409, { error: 'No podés quitarte rbac:manage', code: 'SELF_LOCKOUT' }));
        expect(e).toMatchObject({ status: 409, code: 'SELF_LOCKOUT', isForbidden: false, message: 'No podés quitarte rbac:manage' });
    });

    test('422 expone los errores por campo', () => {
        const e = getApiError(axiosError(422, { error: 'Datos inválidos', code: 'VALIDATION_ERROR', errors: { reason: 'Obligatorio' } }));
        expect(e.code).toBe('VALIDATION_ERROR');
        expect(e.fieldErrors).toEqual({ reason: 'Obligatorio' });
    });

    test('422 sin mensaje usa uno genérico; fieldErrors vacío si no vienen', () => {
        const e = getApiError(axiosError(422, { code: 'VALIDATION_ERROR' }));
        expect(e.message).toMatch(/revisá los datos/i);
        expect(getApiError(axiosError(409, { code: 'NAME_TAKEN', error: 'x' })).fieldErrors).toEqual({});
    });

    test('401 sin code → isUnauthorized', () => {
        const e = getApiError(axiosError(401, { error: 'Token inválido o expirado' }));
        expect(e).toMatchObject({ status: 401, code: null, isUnauthorized: true });
    });

    test('5xx muestra un mensaje genérico (no expone detalles del servidor)', () => {
        const e = getApiError(axiosError(500, { error: 'Traceback: secreto' }));
        expect(e.message).not.toMatch(/Traceback/);
        expect(e.message).toMatch(/error inesperado/i);
    });

    test('body no-JSON (ej. HTML del proxy) no rompe', () => {
        const e = getApiError(axiosError(502, '<html>Bad gateway</html>'));
        expect(e.status).toBe(502);
        expect(e.code).toBeNull();
        expect(e.message).toMatch(/error inesperado/i);
    });

    test('sin respuesta (red caída) → NETWORK_ERROR', () => {
        const e = getApiError(Object.assign(new Error('Network Error'), { request: {} }));
        expect(e).toMatchObject({ status: null, code: 'NETWORK_ERROR', isForbidden: false });
        expect(e.message).toMatch(/conectar con el servidor/i);
    });

    test('error que no es de axios → mensaje genérico', () => {
        const e = getApiError(new TypeError('x is undefined'));
        expect(e.status).toBeNull();
        expect(e.message).toMatch(/error inesperado/i);
    });
});
