// Utilidades SOLO para tests: requieren que el test haga jest.mock('<ruta>/securityApi').
import React from 'react';
import { render, act } from '@testing-library/react';
import { AuthProvider } from '../../auth/AuthContext';
import { PermissionsProvider, StaticPermissionsProvider, usePermissions } from './PermissionsContext';
import { PERM } from './perms';
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

/** Los 14 permisos del rol "Operador" (OPERATOR_ROLE_PERMS en backend/app/rbac/constants.py). */
export const OPERATOR_PERMISSIONS = Object.freeze([
    PERM.ORDERS_READ,
    PERM.ORDERS_CREATE,
    PERM.ORDERS_UPDATE,
    PERM.ORDERS_QUOTE,
    PERM.ORDERS_APPROVE,
    PERM.ORDERS_PRODUCE,
    PERM.ORDERS_DELIVER,
    PERM.CASH_MOVEMENTS_READ,
    PERM.CASH_MOVEMENTS_CREATE,
    PERM.CASH_CATEGORIES_READ,
    PERM.PRINTERS_READ,
    PERM.SETTINGS_READ,
    PERM.MATERIALS_READ,
    PERM.FILAMENTS_READ,
]);

/** render() con permisos fijos (sin AuthProvider ni API). */
export const renderWithPermissions = (ui, { permissions = [], isSuperuser = false, userId = 1, ...options } = {}) => {
    const Wrapper = ({ children }) => (
        <StaticPermissionsProvider permissions={permissions} isSuperuser={isSuperuser} userId={userId}>
            {children}
        </StaticPermissionsProvider>
    );
    return render(ui, { wrapper: Wrapper, ...options });
};

/** Comportamiento previo a RBAC: el superusuario ve todo. Usado por los tests existentes de las vistas. */
export const renderAsSuperuser = (ui, options) => renderWithPermissions(ui, { isSuperuser: true, ...options });

/** Deja resolver las promesas mockeadas pendientes dentro de act (evita warnings de act). */
export const flushPromises = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
