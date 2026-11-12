const MESSAGES = {
    network: 'No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.',
    forbidden: 'Acceso denegado: permisos insuficientes',
    unauthorized: 'Tu sesión expiró. Volvé a iniciar sesión.',
    validation: 'Revisá los datos ingresados.',
    unexpected: 'Ocurrió un error inesperado. Intentá de nuevo más tarde.',
};

/**
 * Normaliza un error de axios a { status, code, message, fieldErrors, isForbidden, isUnauthorized }.
 * Contrato de errores: {"error": "...", "code": "..."} y en 422 además "errors": {campo: msg}.
 * En 5xx no se muestra el texto del servidor (no exponer detalles internos).
 */
export const getApiError = (err) => {
    const response = err && err.response;

    if (!response) {
        const isNetwork = Boolean(err && err.request);
        return {
            status: null,
            code: isNetwork ? 'NETWORK_ERROR' : null,
            message: isNetwork ? MESSAGES.network : MESSAGES.unexpected,
            fieldErrors: {},
            isForbidden: false,
            isUnauthorized: false,
        };
    }

    const { status } = response;
    const data = response.data && typeof response.data === 'object' ? response.data : {};
    const backendMessage = typeof data.error === 'string' && data.error.trim() ? data.error : null;
    const fieldErrors = data.errors && typeof data.errors === 'object' ? data.errors : {};
    let code = typeof data.code === 'string' ? data.code : null;
    let message = backendMessage || MESSAGES.unexpected;

    if (status === 403) {
        code = code || 'FORBIDDEN';
        message = backendMessage || MESSAGES.forbidden;
    } else if (status === 401) {
        message = backendMessage || MESSAGES.unauthorized;
    } else if (status === 422) {
        message = backendMessage || MESSAGES.validation;
    } else if (status >= 500) {
        message = MESSAGES.unexpected;
    }

    return {
        status,
        code,
        message,
        fieldErrors,
        isForbidden: status === 403,
        isUnauthorized: status === 401,
    };
};

export default getApiError;
