import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import * as securityApi from '../securityApi';
import { isKnownPerm } from './perms';

const PermissionsContext = createContext(null);

const IS_DEV = process.env.NODE_ENV !== 'production';

const EMPTY = { status: 'idle', userId: null, isSuperuser: false, permissions: new Set() };

const warnUnknown = (code, origin) => {
    if (IS_DEV && !isKnownPerm(code)) {
        // eslint-disable-next-line no-console
        console.warn(`[permisos] "${code}" (${origin}) no está en PERM: usá PERM.X o sincronizá perms.js con el enum Perm del backend.`);
    }
};

// can/canAny compartidos por el provider real y el estático.
const usePermissionsValue = (state, refresh) => {
    const can = useCallback(
        (perm) => {
            warnUnknown(perm, 'can()');
            if (state.status !== 'ready') return false;
            return state.isSuperuser || state.permissions.has(perm);
        },
        [state]
    );

    const canAny = useCallback((...perms) => perms.some((perm) => can(perm)), [can]);

    return useMemo(
        () => ({ status: state.status, userId: state.userId, isSuperuser: state.isSuperuser, can, canAny, refresh }),
        [state.status, state.userId, state.isSuperuser, can, canAny, refresh]
    );
};

/**
 * Estado global de permisos efectivos. Se carga en cada cambio de token (login, recarga, logout)
 * y vive solo en memoria (no se persiste). Falla cerrada: ante error, ningún permiso.
 */
export const PermissionsProvider = ({ children }) => {
    const { token } = useAuth();
    const [state, setState] = useState(() => (token ? { ...EMPTY, status: 'loading' } : EMPTY));
    // Identifica la carga vigente: descarta respuestas de una sesión/consulta anterior.
    const requestId = useRef(0);

    const load = useCallback(async () => {
        const id = ++requestId.current;
        try {
            const data = await securityApi.getMyPermissions();
            if (id !== requestId.current) return;
            const permissions = new Set(Array.isArray(data?.permissions) ? data.permissions : []);
            permissions.forEach((code) => warnUnknown(code, 'respuesta de /me/permissions'));
            setState({
                status: 'ready',
                userId: Number.isInteger(data?.user_id) ? data.user_id : null,
                isSuperuser: data?.is_superuser === true,
                permissions,
            });
        } catch {
            if (id !== requestId.current) return;
            setState({ ...EMPTY, status: 'error' });
        }
    }, []);

    useEffect(() => {
        if (!token) {
            requestId.current += 1;
            setState(EMPTY);
            return;
        }
        setState({ ...EMPTY, status: 'loading' });
        load();
    }, [token, load]);

    // Reconsulta sin pasar por 'loading' si ya había permisos (no desmonta la pantalla actual).
    const refresh = useCallback(() => {
        if (!token) return Promise.resolve();
        setState((prev) => (prev.status === 'ready' ? prev : { ...EMPTY, status: 'loading' }));
        return load();
    }, [token, load]);

    const value = usePermissionsValue(state, refresh);

    return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

const noopRefresh = () => Promise.resolve();

/**
 * Provider con permisos fijos, sin API (tests de vistas y prototipos). `refresh` es un noop salvo que se pase uno (espía en tests).
 * NO usar en la app: los permisos reales salen de /me/permissions vía PermissionsProvider.
 */
export const StaticPermissionsProvider = ({ permissions = [], isSuperuser = false, userId = null, status = 'ready', refresh = noopRefresh, children }) => {
    const state = useMemo(
        () => ({ status, userId, isSuperuser, permissions: new Set(permissions) }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [status, userId, isSuperuser, permissions.join('|')]
    );
    const value = usePermissionsValue(state, refresh);
    return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

export const usePermissions = () => {
    const context = useContext(PermissionsContext);
    if (!context) {
        throw new Error('usePermissions debe usarse dentro de un PermissionsProvider');
    }
    return context;
};
