import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserAccess } from './securityApi';
import { usePermissions } from './permissions/PermissionsContext';
import { useApiErrorHandler } from './useApiErrorHandler';
import { describeMutationError } from './securityRules';

/**
 * Carga datos de una pantalla: { data, loading, error (getApiError), reload }.
 * `fetcher` se lee de un ref: se carga al montar y cuando cambia alguna de `deps`.
 */
export const useLoader = (fetcher, deps = []) => {
    const handleApiError = useApiErrorHandler();
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;
    const requestId = useRef(0);
    const [state, setState] = useState({ data: null, loading: true, error: null });

    const reload = useCallback(
        async ({ silent = false } = {}) => {
            const id = ++requestId.current;
            if (!silent) setState((prev) => ({ ...prev, loading: true, error: null }));
            try {
                const data = await fetcherRef.current();
                if (id === requestId.current) setState({ data, loading: false, error: null });
            } catch (err) {
                const error = handleApiError(err);
                if (id === requestId.current) setState({ data: null, loading: false, error });
            }
        },
        [handleApiError]
    );

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { ...state, reload };
};

/**
 * Mi propio acceso efectivo (GET /api/rbac/users/<yo>/access), para deshabilitar en el front
 * las acciones que darían SELF_ASSIGNMENT (indirecto) o SELF_LOCKOUT. El superusuario está exento.
 * Si no se puede cargar, no se bloquea nada en el front (el backend responde 409 igual).
 */
export const useMyAccess = () => {
    const { userId, isSuperuser, status } = usePermissions();
    const [myAccess, setMyAccess] = useState(null);

    const reloadMyAccess = useCallback(async () => {
        if (status !== 'ready' || isSuperuser || !userId) {
            setMyAccess(null);
            return;
        }
        try {
            setMyAccess(await getUserAccess(userId));
        } catch {
            setMyAccess(null);
        }
    }, [status, isSuperuser, userId]);

    useEffect(() => {
        reloadMyAccess();
    }, [reloadMyAccess]);

    return { myAccess, myUserId: userId, isSuperuser, reloadMyAccess };
};

/**
 * Ejecuta una escritura de Seguridad: toast de éxito, refresh() de mis permisos y `onChanged()`
 * (recargar los datos afectados). Error: toast claro (403 → sin permiso y refresh; 409 → mensaje con code).
 * También recarga tras un 409 (los datos pueden estar desactualizados). Devuelve { ok, result | error }.
 */
export const useSecurityMutation = (toast, onChanged) => {
    const { refresh } = usePermissions();
    const handleApiError = useApiErrorHandler();
    const onChangedRef = useRef(onChanged);
    onChangedRef.current = onChanged;

    return useCallback(
        async (action, successMessage) => {
            try {
                const result = await action();
                toast.current?.show({ severity: 'success', summary: successMessage, life: 3000 });
                await Promise.all([refresh(), onChangedRef.current?.()]);
                return { ok: true, result };
            } catch (err) {
                const error = handleApiError(err);
                const { summary, detail } = describeMutationError(error);
                toast.current?.show({ severity: 'error', summary, detail, life: 6000 });
                if (error.status === 409) await onChangedRef.current?.();
                return { ok: false, error };
            }
        },
        [toast, refresh, handleApiError]
    );
};
