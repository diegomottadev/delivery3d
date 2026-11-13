import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import GroupsListView from './GroupsListView';
import * as securityApi from '../securityApi';
import { PERM } from '../permissions/perms';
import { renderSecurityView, axiosError, clickAndFlush, READ, rowWith } from '../securityTestUtils';

jest.mock('../securityApi');

const GROUPS = [
    { id: 3, name: 'Operadores', description: 'Operadores del taller', members_count: 4, roles_count: 1 },
    { id: 4, name: 'Seguridad', description: 'Administran la seguridad', members_count: 1, roles_count: 1 },
];

const MY_ACCESS = {
    user_id: 1,
    is_superuser: false,
    roles: [],
    permissions: [{ code: PERM.RBAC_MANAGE, sources: [{ type: 'group', group: { id: 4, name: 'Seguridad' }, role: { id: 9, name: 'Admin' } }] }],
};

const IMPACT = { affected_users_count: 4, users_losing_permissions_count: 2, affected_users: [], removes_own_rbac_manage: false };

const renderList = (options) => renderSecurityView(<GroupsListView />, { route: '/seguridad/grupos', ...options });

describe('GroupsListView (/seguridad/grupos)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        securityApi.listGroups.mockResolvedValue(GROUPS);
        securityApi.getUserAccess.mockResolvedValue(MY_ACCESS);
    });

    test('lista los grupos con link al detalle y cantidades', async () => {
        await renderList();
        expect(screen.getByRole('link', { name: 'Operadores' })).toHaveAttribute('href', '/seguridad/grupos/3');
        const row = rowWith('Operadores del taller');
        expect(within(row).getByText('4')).toBeInTheDocument();
    });

    test('la búsqueda filtra en el front', async () => {
        await renderList();
        fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'segu' } });
        expect(screen.queryByText('Operadores')).not.toBeInTheDocument();
        expect(screen.getByText('Seguridad')).toBeInTheDocument();
        expect(securityApi.listGroups).toHaveBeenCalledTimes(1);
    });

    test('solo rbac:read: sin crear, editar ni eliminar', async () => {
        await renderList({ permissions: READ });
        expect(screen.queryByRole('button', { name: /Nuevo grupo|Editar|Eliminar/ })).not.toBeInTheDocument();
    });

    test('crear un grupo: nombre obligatorio, envía nombre y descripción, refresca y recarga', async () => {
        securityApi.createGroup.mockResolvedValue({ id: 9, name: 'Ventas', description: '', members: [], roles: [] });
        const { refresh } = await renderList();
        fireEvent.click(screen.getByRole('button', { name: /Nuevo grupo/ }));
        const save = screen.getByRole('button', { name: 'Guardar' });
        expect(save).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: ' Ventas ' } });
        fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Mostrador' } });
        await clickAndFlush(save);
        expect(securityApi.createGroup).toHaveBeenCalledWith({ name: 'Ventas', description: 'Mostrador' });
        expect(refresh).toHaveBeenCalled();
        expect(securityApi.listGroups).toHaveBeenCalledTimes(2);
    });

    test('409 NAME_TAKEN: el diálogo queda abierto con el error en el nombre y toast con el code', async () => {
        securityApi.createGroup.mockRejectedValue(axiosError(409, { error: 'Ya existe un grupo con ese nombre', code: 'NAME_TAKEN' }));
        await renderList();
        fireEvent.click(screen.getByRole('button', { name: /Nuevo grupo/ }));
        fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: 'Operadores' } });
        await clickAndFlush(screen.getByRole('button', { name: 'Guardar' }));
        expect(screen.getByText('Ya existe un grupo con ese nombre (NAME_TAKEN)')).toBeInTheDocument();
        expect(screen.getByText('Ya existe un grupo con ese nombre', { selector: 'small' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
    });

    test('editar precarga los datos y hace PUT', async () => {
        securityApi.updateGroup.mockResolvedValue({ ...GROUPS[0], name: 'Operarios' });
        await renderList();
        fireEvent.click(screen.getByRole('button', { name: 'Editar Operadores' }));
        expect(screen.getByLabelText(/Nombre/)).toHaveValue('Operadores');
        fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: 'Operarios' } });
        await clickAndFlush(screen.getByRole('button', { name: 'Guardar' }));
        expect(securityApi.updateGroup).toHaveBeenCalledWith(3, { name: 'Operarios', description: 'Operadores del taller' });
    });

    test('eliminar pide confirmación con el impacto y borra', async () => {
        securityApi.getGroupRemovalImpact.mockResolvedValue(IMPACT);
        securityApi.deleteGroup.mockResolvedValue(undefined);
        await renderList();
        await clickAndFlush(screen.getByRole('button', { name: 'Eliminar Operadores' }));
        expect(screen.getByTestId('impact-affected-count')).toHaveTextContent('4');
        expect(screen.getByTestId('impact-losing-count')).toHaveTextContent('2');
        await clickAndFlush(screen.getByRole('button', { name: 'Eliminar' }));
        expect(securityApi.deleteGroup).toHaveBeenCalledWith(3);
    });

    test('no puedo eliminar el único grupo que me da rbac:manage (SELF_LOCKOUT)', async () => {
        await renderList();
        expect(screen.getByRole('button', { name: 'Eliminar Seguridad' })).toBeDisabled();
        expect(screen.getByTestId('delete-blocked-4')).toHaveTextContent(/SELF_LOCKOUT/);
        expect(screen.getByRole('button', { name: 'Eliminar Operadores' })).toBeEnabled();
    });

    test('si el impacto dice removes_own_rbac_manage, no se puede confirmar', async () => {
        securityApi.getUserAccess.mockResolvedValue({ ...MY_ACCESS, permissions: [] });
        securityApi.getGroupRemovalImpact.mockResolvedValue({ ...IMPACT, removes_own_rbac_manage: true });
        await renderList();
        await clickAndFlush(screen.getByRole('button', { name: 'Eliminar Operadores' }));
        expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
        expect(screen.getByTestId('impact-blocked')).toBeInTheDocument();
    });

    test('409 SELF_LOCKOUT del backend → mensaje con el code', async () => {
        securityApi.getGroupRemovalImpact.mockResolvedValue(IMPACT);
        securityApi.deleteGroup.mockRejectedValue(axiosError(409, { error: 'No podés quitarte a vos mismo el permiso de administrar seguridad', code: 'SELF_LOCKOUT' }));
        await renderList();
        await clickAndFlush(screen.getByRole('button', { name: 'Eliminar Operadores' }));
        await clickAndFlush(screen.getByRole('button', { name: 'Eliminar' }));
        expect(screen.getByText('No podés quitarte a vos mismo el permiso de administrar seguridad (SELF_LOCKOUT)')).toBeInTheDocument();
    });

    test('403 en una acción → aviso de permiso y refresh de permisos', async () => {
        securityApi.getGroupRemovalImpact.mockResolvedValue(IMPACT);
        securityApi.deleteGroup.mockRejectedValue(axiosError(403, { error: 'Acceso denegado: permisos insuficientes', code: 'FORBIDDEN' }));
        const { refresh } = await renderList();
        await clickAndFlush(screen.getByRole('button', { name: 'Eliminar Operadores' }));
        await clickAndFlush(screen.getByRole('button', { name: 'Eliminar' }));
        expect(screen.getByText('No tenés permiso para realizar esta acción.')).toBeInTheDocument();
        expect(refresh).toHaveBeenCalled();
    });

    test('403 en la carga → ForbiddenNotice', async () => {
        securityApi.listGroups.mockRejectedValue(axiosError(403, { code: 'FORBIDDEN' }));
        await renderList();
        expect(screen.getByTestId('forbidden-notice')).toBeInTheDocument();
    });
});
