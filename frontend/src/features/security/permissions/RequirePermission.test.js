import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequirePermission } from './RequirePermission';
import { PERM } from './perms';
import * as securityApi from '../securityApi';
import {
    AllProviders,
    startSession,
    mockMyPermissions,
    mockMyPermissionsPending,
    mockMyPermissionsError,
} from './permissionsTestUtils';

jest.mock('../securityApi');
jest.mock('../../auth/authApi');

const renderAt = (path, guardProps = { perm: PERM.RBAC_READ }) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <AllProviders>
                <Routes>
                    <Route
                        path="/seguridad/roles"
                        element={
                            <RequirePermission {...guardProps}>
                                <h2>Pantalla de roles</h2>
                            </RequirePermission>
                        }
                    />
                    <Route path="/acceso-denegado" element={<h2>Página 403</h2>} />
                </Routes>
            </AllProviders>
        </MemoryRouter>
    );

describe('<RequirePermission>', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        startSession();
    });

    test('con el permiso renderiza la pantalla protegida', async () => {
        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        renderAt('/seguridad/roles');
        expect(await screen.findByText('Pantalla de roles')).toBeInTheDocument();
    });

    test('sin el permiso redirige a /acceso-denegado', async () => {
        mockMyPermissions({ permissions: ['orders:read'] });
        renderAt('/seguridad/roles');
        expect(await screen.findByText('Página 403')).toBeInTheDocument();
        expect(screen.queryByText('Pantalla de roles')).not.toBeInTheDocument();
    });

    test('anyOf: pasa si tiene alguno de los permisos', async () => {
        mockMyPermissions({ permissions: [PERM.RBAC_MANAGE] });
        renderAt('/seguridad/roles', { anyOf: [PERM.RBAC_READ, PERM.RBAC_MANAGE] });
        expect(await screen.findByText('Pantalla de roles')).toBeInTheDocument();
    });

    test('superusuario pasa sin permisos explícitos', async () => {
        mockMyPermissions({ permissions: [], isSuperuser: true });
        renderAt('/seguridad/roles');
        expect(await screen.findByText('Pantalla de roles')).toBeInTheDocument();
    });

    test('mientras carga muestra un spinner y NO redirige', () => {
        mockMyPermissionsPending();
        renderAt('/seguridad/roles');
        expect(screen.getByTestId('permissions-loading')).toBeInTheDocument();
        expect(screen.queryByText('Página 403')).not.toBeInTheDocument();
        expect(screen.queryByText('Pantalla de roles')).not.toBeInTheDocument();
    });

    test('si falla la carga queda cerrado, muestra "Reintentar" y al reintentar con éxito entra', async () => {
        mockMyPermissionsError();
        renderAt('/seguridad/roles');
        const retry = await screen.findByRole('button', { name: /Reintentar/i });
        expect(screen.queryByText('Pantalla de roles')).not.toBeInTheDocument();
        expect(screen.queryByText('Página 403')).not.toBeInTheDocument();

        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        fireEvent.click(retry);
        expect(await screen.findByText('Pantalla de roles')).toBeInTheDocument();
        await waitFor(() => expect(securityApi.getMyPermissions).toHaveBeenCalledTimes(2));
    });
});
