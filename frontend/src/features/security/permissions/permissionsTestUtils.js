// Utilidades SOLO para tests: requieren que el test haga jest.mock('<ruta>/securityApi').
import React from 'react';
import { AuthProvider } from '../../auth/AuthContext';
import { PermissionsProvider, usePermissions } from './PermissionsContext';
import * as securityApi from '../securityApi';

export const startSession = () => {
    localStorage.setItem('token', 'token-de-prueba');
    localStorage.setItem('user', JSON.stringify({ id: 1, username: 'operador' }));
};

export const mockMyPermissions = ({ permissions = [], isSuperuser = false } = {}) => {
    securityApi.getMyPermissions.mockResolvedValue({ user_id: 1, is_superuser: isSuperuser, permissions });
};

export const mockMyPermissionsPending = () => {
    securityApi.getMyPermissions.mockReturnValue(new Promise(() => {}));
};

export const mockMyPermissionsError = () => {
    securityApi.getMyPermissions.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));
};

export const AllProviders = ({ children }) => (
    <AuthProvider>
        <PermissionsProvider>{children}</PermissionsProvider>
    </AuthProvider>
);

/** Expone el status de permisos para esperar a que termine la carga (evita warnings de act). */
export const PermissionsStatusProbe = () => {
    const { status } = usePermissions();
    return <span data-testid="permissions-status">{status}</span>;
};
