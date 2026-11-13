import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import RolesListView from './RolesListView';
import * as securityApi from '../securityApi';
import { renderSecurityView, axiosError, clickAndFlush, READ, rowWith } from '../securityTestUtils';

jest.mock('../securityApi');

const ROLES = [
    { id: 2, name: 'Operador', description: 'Taller', permissions_count: 14, groups_count: 1, direct_users_count: 0 },
    { id: 7, name: 'Borrador', description: 'Sin uso', permissions_count: 0, groups_count: 0, direct_users_count: 0 },
];

const renderList = (options) => renderSecurityView(<RolesListView />, { route: '/seguridad/roles', ...options });

describe('RolesListView (/seguridad/roles)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        securityApi.listRoles.mockResolvedValue(ROLES);
        securityApi.getUserAccess.mockResolvedValue({ user_id: 1, is_superuser: false, roles: [], permissions: [] });
    });

    test('lista los roles con cantidad de permisos, grupos y usuarios directos', async () => {
        await renderList();
        expect(screen.getByRole('link', { name: 'Operador' })).toHaveAttribute('href', '/seguridad/roles/2');
        expect(within(rowWith('Taller')).getByText('14')).toBeInTheDocument();
    });

    test('un rol en uso no se puede eliminar (ROLE_IN_USE), con explicación', async () => {
        await renderList();
        expect(screen.getByRole('button', { name: 'Eliminar Operador' })).toBeDisabled();
        expect(screen.getByTestId('delete-blocked-2')).toHaveTextContent(/ROLE_IN_USE/);
        expect(screen.getByRole('button', { name: 'Eliminar Borrador' })).toBeEnabled();
    });

    test('crear rol hace POST con nombre y descripción', async () => {
        securityApi.createRole.mockResolvedValue({ id: 9, name: 'Auditor', description: '', permissions: [] });
        await renderList();
        fireEvent.click(screen.getByRole('button', { name: /Nuevo rol/ }));
        fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: 'Auditor' } });
        await clickAndFlush(screen.getByRole('button', { name: 'Guardar' }));
        expect(securityApi.createRole).toHaveBeenCalledWith({ name: 'Auditor', description: '' });
    });

    test('nombre de más de 100 caracteres no se puede guardar', async () => {
        await renderList();
        fireEvent.click(screen.getByRole('button', { name: /Nuevo rol/ }));
        fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: 'x'.repeat(101) } });
        expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    });

    test('409 ROLE_IN_USE del backend (datos viejos) → mensaje con el code y recarga', async () => {
        securityApi.getRoleRemovalImpact.mockResolvedValue({ affected_users_count: 0, users_losing_permissions_count: 0, affected_users: [], removes_own_rbac_manage: false });
        securityApi.deleteRole.mockRejectedValue(axiosError(409, { error: 'El rol está en uso', code: 'ROLE_IN_USE' }));
        await renderList();
        await clickAndFlush(screen.getByRole('button', { name: 'Eliminar Borrador' }));
        await clickAndFlush(screen.getByRole('button', { name: 'Eliminar' }));
        expect(screen.getByText('El rol está en uso (ROLE_IN_USE)')).toBeInTheDocument();
        expect(securityApi.listRoles).toHaveBeenCalledTimes(2);
    });

    test('solo rbac:read: sin acciones de escritura', async () => {
        await renderList({ permissions: READ });
        expect(screen.queryByRole('button', { name: /Nuevo rol|Editar|Eliminar/ })).not.toBeInTheDocument();
    });
});
