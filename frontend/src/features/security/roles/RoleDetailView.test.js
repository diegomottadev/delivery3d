import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import RoleDetailView from './RoleDetailView';
import * as securityApi from '../securityApi';
import { PERM } from '../permissions/perms';
import { renderSecurityView, axiosError, clickAndFlush, READ } from '../securityTestUtils';

jest.mock('../securityApi');

const CATALOG = [
    {
        resource: 'orders',
        resource_label: 'Pedidos',
        permissions: [
            { code: 'orders:read', action: 'read', description: 'Ver pedidos', roles: [] },
            { code: 'orders:delete', action: 'delete', description: 'Eliminar pedidos', roles: [] },
        ],
    },
    {
        resource: 'rbac',
        resource_label: 'Seguridad',
        permissions: [
            { code: 'rbac:read', action: 'read', description: 'Ver la configuración de seguridad', roles: [] },
            { code: 'rbac:manage', action: 'manage', description: 'Administrar la seguridad', roles: [] },
        ],
    },
];

const ROLE = { id: 2, name: 'Operador', description: 'Taller', created_at: '2026-11-12T12:00:00', updated_at: '2026-11-12T12:00:00', permissions: ['orders:read'] };
const ADMIN_ROLE = { ...ROLE, id: 9, name: 'Admin seguridad', permissions: ['rbac:manage', 'rbac:read'] };

const NOT_MINE = { user_id: 1, is_superuser: false, roles: [], permissions: [] };
const MINE = {
    user_id: 1,
    is_superuser: false,
    roles: [{ role: { id: 9, name: 'Admin seguridad' }, sources: [{ type: 'group', group: { id: 4, name: 'Seguridad' } }] }],
    permissions: [{ code: PERM.RBAC_MANAGE, sources: [{ type: 'group', group: { id: 4, name: 'Seguridad' }, role: { id: 9, name: 'Admin seguridad' } }] }],
};

const IMPACT = { affected_users_count: 3, users_losing_permissions_count: 2, affected_users: [{ id: 7, username: 'ana', lost_permissions: ['orders:read'] }], removes_own_rbac_manage: false };

const renderDetail = (roleId = 2, options = {}) => renderSecurityView(<RoleDetailView />, { route: '/seguridad/roles/:roleId', path: `/seguridad/roles/${roleId}`, ...options });

const checkbox = (label) => screen.getByRole('checkbox', { name: label });

describe('RoleDetailView (/seguridad/roles/:roleId)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        securityApi.getRole.mockImplementation((id) => Promise.resolve(Number(id) === 9 ? ADMIN_ROLE : ROLE));
        securityApi.listPermissionCatalog.mockResolvedValue(CATALOG);
        securityApi.getUserAccess.mockResolvedValue(NOT_MINE);
    });

    test('checkboxes agrupados por resource_label, con la descripción (no el code) y el estado actual', async () => {
        await renderDetail();
        const orders = screen.getByTestId('perm-group-orders');
        expect(within(orders).getByText('Pedidos')).toBeInTheDocument();
        expect(within(screen.getByTestId('perm-group-rbac')).getByText('Seguridad')).toBeInTheDocument();
        expect(checkbox('Ver pedidos')).toBeChecked();
        expect(checkbox('Eliminar pedidos')).not.toBeChecked();
        expect(screen.queryByText('orders:read')).not.toBeInTheDocument();
    });

    test('agregar permisos guarda el set completo ordenado (sin confirmación: nadie pierde nada)', async () => {
        securityApi.setRolePermissions.mockResolvedValue({ ...ROLE, permissions: ['orders:delete', 'orders:read'] });
        const { refresh } = await renderDetail();
        const save = screen.getByRole('button', { name: /Guardar permisos/ });
        expect(save).toBeDisabled();
        fireEvent.click(checkbox('Eliminar pedidos'));
        expect(save).toBeEnabled();
        await clickAndFlush(save);
        expect(securityApi.setRolePermissions).toHaveBeenCalledWith(2, ['orders:delete', 'orders:read']);
        expect(securityApi.previewRolePermissionsImpact).not.toHaveBeenCalled();
        expect(refresh).toHaveBeenCalled();
    });

    test('quitar permisos confirma con el impacto previo del nuevo set', async () => {
        securityApi.previewRolePermissionsImpact.mockResolvedValue(IMPACT);
        securityApi.setRolePermissions.mockResolvedValue({ ...ROLE, permissions: [] });
        await renderDetail();
        fireEvent.click(checkbox('Ver pedidos'));
        await clickAndFlush(screen.getByRole('button', { name: /Guardar permisos/ }));
        expect(securityApi.previewRolePermissionsImpact).toHaveBeenCalledWith(2, []);
        expect(screen.getByTestId('impact-affected-count')).toHaveTextContent('3');
        expect(screen.getByTestId('impact-losing-count')).toHaveTextContent('2');
        // Lo que pierde cada usuario se describe, no se muestra el code.
        expect(screen.getByRole('listitem')).toHaveTextContent('ana: Ver pedidos');
        expect(securityApi.setRolePermissions).not.toHaveBeenCalled();
        await clickAndFlush(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(securityApi.setRolePermissions).toHaveBeenCalledWith(2, []);
    });

    test('"Descartar" vuelve al estado guardado', async () => {
        await renderDetail();
        fireEvent.click(checkbox('Eliminar pedidos'));
        fireEvent.click(screen.getByRole('button', { name: /Descartar/ }));
        expect(checkbox('Eliminar pedidos')).not.toBeChecked();
        expect(screen.getByRole('button', { name: /Guardar permisos/ })).toBeDisabled();
    });

    test('tengo este rol: no puedo sumarle permisos (SELF_ASSIGNMENT) pero sí quitar', async () => {
        securityApi.getUserAccess.mockResolvedValue({
            ...MINE,
            permissions: [
                {
                    code: PERM.RBAC_MANAGE,
                    sources: [
                        { type: 'group', group: { id: 4, name: 'Seguridad' }, role: { id: 9, name: 'Admin seguridad' } },
                        { type: 'direct', role: { id: 11, name: 'Otro' } },
                    ],
                },
            ],
        });
        await renderDetail(9);
        fireEvent.click(checkbox('Ver pedidos'));
        expect(screen.getByRole('button', { name: /Guardar permisos/ })).toBeDisabled();
        expect(screen.getByTestId('blocked-reason')).toHaveTextContent(/SELF_ASSIGNMENT/);
        fireEvent.click(checkbox('Ver pedidos'));
        fireEvent.click(checkbox('Ver la configuración de seguridad'));
        expect(screen.getByRole('button', { name: /Guardar permisos/ })).toBeEnabled();
        expect(screen.queryByTestId('blocked-reason')).not.toBeInTheDocument();
    });

    test('quitar rbac:manage del rol del que depende mi rbac:manage → deshabilitado (SELF_LOCKOUT)', async () => {
        securityApi.getUserAccess.mockResolvedValue(MINE);
        await renderDetail(9);
        fireEvent.click(checkbox('Administrar la seguridad'));
        expect(screen.getByRole('button', { name: /Guardar permisos/ })).toBeDisabled();
        expect(screen.getByTestId('blocked-reason')).toHaveTextContent(/SELF_LOCKOUT/);
    });

    test('superusuario: puede sumar permisos a un rol que tiene', async () => {
        await renderDetail(9, { isSuperuser: true, permissions: [] });
        fireEvent.click(checkbox('Ver pedidos'));
        expect(screen.getByRole('button', { name: /Guardar permisos/ })).toBeEnabled();
    });

    test('422 UNKNOWN_PERMISSION → mensaje', async () => {
        securityApi.setRolePermissions.mockRejectedValue(axiosError(422, { error: 'Permiso desconocido: foo:bar', code: 'UNKNOWN_PERMISSION' }));
        await renderDetail();
        fireEvent.click(checkbox('Eliminar pedidos'));
        await clickAndFlush(screen.getByRole('button', { name: /Guardar permisos/ }));
        expect(screen.getByText(/Permiso desconocido: foo:bar/)).toBeInTheDocument();
    });

    test('solo rbac:read: checkboxes deshabilitados y sin botones de escritura', async () => {
        await renderDetail(2, { permissions: READ });
        expect(checkbox('Ver pedidos')).toBeDisabled();
        expect(screen.queryByRole('button', { name: /Guardar|Editar|Descartar/ })).not.toBeInTheDocument();
    });

    test('editar nombre y descripción del rol', async () => {
        securityApi.updateRole.mockResolvedValue(ROLE);
        await renderDetail();
        fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
        fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: 'Operario' } });
        await clickAndFlush(screen.getByRole('button', { name: 'Guardar' }));
        expect(securityApi.updateRole).toHaveBeenCalledWith(2, { name: 'Operario', description: 'Taller' });
    });

    test('403 → ForbiddenNotice', async () => {
        securityApi.getRole.mockRejectedValue(axiosError(403, { code: 'FORBIDDEN' }));
        await renderDetail();
        expect(screen.getByTestId('forbidden-notice')).toBeInTheDocument();
    });
});
