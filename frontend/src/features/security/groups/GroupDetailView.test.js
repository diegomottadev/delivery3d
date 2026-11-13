import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import GroupDetailView from './GroupDetailView';
import * as securityApi from '../securityApi';
import { PERM } from '../permissions/perms';
import { renderSecurityView, axiosError, clickAndFlush, selectOption, READ, rowWith } from '../securityTestUtils';

jest.mock('../securityApi');

const GROUP = {
    id: 3,
    name: 'Operadores',
    description: 'Operadores del taller',
    created_at: '2026-11-12T12:00:00',
    updated_at: '2026-11-12T12:00:00',
    members: [
        { id: 7, username: 'ana', is_active: true },
        { id: 8, username: 'beto', is_active: false },
    ],
    roles: [{ id: 2, name: 'Operador', description: 'Taller' }],
};

const SECURITY_GROUP = {
    ...GROUP,
    id: 4,
    name: 'Seguridad',
    members: [{ id: 1, username: 'operador', is_active: true }],
    roles: [{ id: 9, name: 'Admin seguridad', description: '' }],
};

const MY_ACCESS = {
    user_id: 1,
    is_superuser: false,
    roles: [{ role: { id: 9, name: 'Admin seguridad' }, sources: [{ type: 'group', group: { id: 4, name: 'Seguridad' } }] }],
    permissions: [{ code: PERM.RBAC_MANAGE, sources: [{ type: 'group', group: { id: 4, name: 'Seguridad' }, role: { id: 9, name: 'Admin seguridad' } }] }],
};

const IMPACT = {
    affected_users_count: 2,
    users_losing_permissions_count: 1,
    affected_users: [
        { id: 7, username: 'ana', lost_permissions: ['orders:update'] },
        { id: 8, username: 'beto', lost_permissions: [] },
    ],
    removes_own_rbac_manage: false,
};

const renderDetail = (groupId = 3, options = {}) => renderSecurityView(<GroupDetailView />, { route: '/seguridad/grupos/:groupId', path: `/seguridad/grupos/${groupId}`, ...options });

describe('GroupDetailView (/seguridad/grupos/:groupId)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        securityApi.getGroup.mockImplementation((id) => Promise.resolve(Number(id) === 4 ? SECURITY_GROUP : GROUP));
        securityApi.getUserAccess.mockResolvedValue(MY_ACCESS);
        securityApi.listUsers.mockResolvedValue([
            { id: 1, username: 'operador' },
            { id: 7, username: 'ana' },
            { id: 10, username: 'carla' },
        ]);
        securityApi.listRoles.mockResolvedValue([
            { id: 2, name: 'Operador' },
            { id: 5, name: 'Auditor' },
        ]);
    });

    test('muestra datos, miembros (con link) y roles', async () => {
        await renderDetail();
        expect(screen.getByRole('heading', { name: 'Operadores' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'ana' })).toHaveAttribute('href', '/seguridad/usuarios/7');
        expect(within(rowWith('beto')).getByText('Inactivo')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Operador' })).toHaveAttribute('href', '/seguridad/roles/2');
    });

    test('quitar un rol pide confirmación con ConfirmImpactDialog (los dos números) y recién ahí quita', async () => {
        securityApi.getGroupRoleRemovalImpact.mockResolvedValue(IMPACT);
        securityApi.removeGroupRole.mockResolvedValue(undefined);
        const { refresh } = await renderDetail();
        await clickAndFlush(screen.getByRole('button', { name: 'Quitar rol Operador' }));
        expect(securityApi.getGroupRoleRemovalImpact).toHaveBeenCalledWith(3, 2);
        expect(securityApi.removeGroupRole).not.toHaveBeenCalled();
        expect(screen.getByTestId('impact-affected-count')).toHaveTextContent('2');
        expect(screen.getByTestId('impact-losing-count')).toHaveTextContent('1');
        await clickAndFlush(screen.getByRole('button', { name: 'Quitar rol' }));
        expect(securityApi.removeGroupRole).toHaveBeenCalledWith(3, 2);
        expect(refresh).toHaveBeenCalled();
        expect(securityApi.getGroup).toHaveBeenCalledTimes(2);
    });

    test('cancelar la confirmación no quita nada', async () => {
        securityApi.getGroupRoleRemovalImpact.mockResolvedValue(IMPACT);
        await renderDetail();
        await clickAndFlush(screen.getByRole('button', { name: 'Quitar rol Operador' }));
        await clickAndFlush(screen.getByRole('button', { name: 'Cancelar' }));
        expect(securityApi.removeGroupRole).not.toHaveBeenCalled();
    });

    test('agregar miembro: ofrece usuarios que no son miembros; a mí me muestra deshabilitado (SELF_ASSIGNMENT)', async () => {
        securityApi.addGroupMember.mockResolvedValue(GROUP);
        await renderDetail();
        const options = within(screen.getByLabelText('Usuario a agregar')).getAllByRole('option');
        expect(options.map((o) => o.textContent)).toEqual(['Elegí un usuario…', 'operador (vos: no podés agregarte)', 'carla']);
        expect(options[1]).toBeDisabled();
        selectOption('Usuario a agregar', 10);
        await clickAndFlush(screen.getByRole('button', { name: /Agregar miembro/ }));
        expect(securityApi.addGroupMember).toHaveBeenCalledWith(3, 10);
    });

    test('agregar rol a un grupo del que no soy miembro', async () => {
        securityApi.addGroupRole.mockResolvedValue(GROUP);
        await renderDetail();
        expect(within(screen.getByLabelText('Rol a agregar')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Elegí un rol…', 'Auditor']);
        selectOption('Rol a agregar', 5);
        await clickAndFlush(screen.getByRole('button', { name: /Agregar rol/ }));
        expect(securityApi.addGroupRole).toHaveBeenCalledWith(3, 5);
    });

    test('soy miembro: no puedo agregar roles al grupo (SELF_ASSIGNMENT indirecto)', async () => {
        await renderDetail(4);
        expect(screen.getByRole('button', { name: /Agregar rol/ })).toBeDisabled();
        expect(screen.getByLabelText('Rol a agregar')).toBeDisabled();
        expect(screen.getByTestId('blocked-reason')).toHaveTextContent(/SELF_ASSIGNMENT/);
    });

    test('no puedo quitar el rol ni salir del grupo que me da rbac:manage (SELF_LOCKOUT)', async () => {
        await renderDetail(4);
        expect(screen.getByRole('button', { name: 'Quitar rol Admin seguridad' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Quitar a operador' })).toBeDisabled();
        expect(screen.getAllByTestId('lockout-reason')).toHaveLength(2);
    });

    test('superusuario: exento de SELF_ASSIGNMENT y SELF_LOCKOUT', async () => {
        await renderDetail(4, { isSuperuser: true, permissions: [] });
        expect(screen.getByLabelText('Rol a agregar')).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Quitar rol Admin seguridad' })).toBeEnabled();
        expect(securityApi.getUserAccess).not.toHaveBeenCalled();
    });

    test('409 SELF_ASSIGNMENT del backend → mensaje claro con el code', async () => {
        securityApi.addGroupRole.mockRejectedValue(axiosError(409, { error: 'No podés asignarte roles ni permisos a vos mismo', code: 'SELF_ASSIGNMENT' }));
        await renderDetail();
        selectOption('Rol a agregar', 5);
        await clickAndFlush(screen.getByRole('button', { name: /Agregar rol/ }));
        expect(screen.getByText('No podés asignarte roles ni permisos a vos mismo (SELF_ASSIGNMENT)')).toBeInTheDocument();
    });

    test('quitar miembro usa el impacto de membresía', async () => {
        securityApi.getGroupMemberRemovalImpact.mockResolvedValue(IMPACT);
        securityApi.removeGroupMember.mockResolvedValue(undefined);
        await renderDetail();
        await clickAndFlush(screen.getByRole('button', { name: 'Quitar a ana' }));
        expect(securityApi.getGroupMemberRemovalImpact).toHaveBeenCalledWith(3, 7);
        await clickAndFlush(screen.getByRole('button', { name: 'Quitar miembro' }));
        expect(securityApi.removeGroupMember).toHaveBeenCalledWith(3, 7);
    });

    test('si el impacto no se puede calcular no se habilita confirmar', async () => {
        securityApi.getGroupRoleRemovalImpact.mockRejectedValue(axiosError(500, {}));
        await renderDetail();
        await clickAndFlush(screen.getByRole('button', { name: 'Quitar rol Operador' }));
        expect(screen.getByText(/No se pudo calcular el impacto/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Quitar rol' })).toBeDisabled();
    });

    test('editar el grupo hace PUT con nombre y descripción', async () => {
        securityApi.updateGroup.mockResolvedValue(GROUP);
        await renderDetail();
        fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
        fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Nueva' } });
        await clickAndFlush(screen.getByRole('button', { name: 'Guardar' }));
        expect(securityApi.updateGroup).toHaveBeenCalledWith(3, { name: 'Operadores', description: 'Nueva' });
    });

    test('solo rbac:read: sin acciones de escritura ni carga de opciones', async () => {
        await renderDetail(3, { permissions: READ });
        expect(screen.queryByRole('button', { name: /Quitar|Agregar|Editar/ })).not.toBeInTheDocument();
        expect(securityApi.listUsers).not.toHaveBeenCalled();
    });

    test('404 → el grupo no existe', async () => {
        securityApi.getGroup.mockRejectedValue(axiosError(404, { error: 'Grupo no encontrado', code: 'NOT_FOUND' }));
        await renderDetail(99);
        expect(screen.getByText('El grupo no existe.')).toBeInTheDocument();
    });
});
