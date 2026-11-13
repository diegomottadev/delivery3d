import { useCallback } from 'react';
import { getApiError } from './apiError';
import { usePermissions } from './permissions/PermissionsContext';

/**
 * Devuelve handleApiError(err) → error normalizado. Ante un 403 refresca /me/permissions:
 * si al usuario le quitaron permisos, el menú y los guards se actualizan solos.
 * Los 409 de negocio (SELF_LOCKOUT, SELF_ASSIGNMENT, ROLE_IN_USE…) no refrescan.
 */
export const useApiErrorHandler = () => {
    const { refresh } = usePermissions();
    return useCallback(
        (err) => {
            const apiError = getApiError(err);
            if (apiError.isForbidden) {
                refresh();
            }
            return apiError;
        },
        [refresh]
    );
};

export default useApiErrorHandler;
