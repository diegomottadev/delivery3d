import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from './PermissionsContext';
import { PermissionsLoadError } from './PermissionsLoadError';

export const ACCESS_DENIED_PATH = '/acceso-denegado';

/**
 * Guard de ruta. Cargando → spinner (no redirige); error → aviso con "Reintentar" (cerrado);
 * sin permiso → /acceso-denegado. Es solo UX: el backend valida cada endpoint.
 */
export const RequirePermission = ({ perm, anyOf, children }) => {
    const { status, can, canAny } = usePermissions();
    const location = useLocation();

    if (status === 'loading' || status === 'idle') {
        return (
            <div className="flex align-items-center justify-content-center p-5" data-testid="permissions-loading">
                <i className="pi pi-spin pi-spinner text-4xl text-primary" aria-label="Cargando permisos"></i>
            </div>
        );
    }

    if (status === 'error') {
        return <PermissionsLoadError />;
    }

    const allowed = anyOf ? canAny(...anyOf) : can(perm);
    if (!allowed) {
        return <Navigate to={ACCESS_DENIED_PATH} replace state={{ from: location }} />;
    }

    return children;
};

export default RequirePermission;
