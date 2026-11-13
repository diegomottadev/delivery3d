import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import UserDetailView from './UserDetailView';
import * as securityApi from '../securityApi';
import { PERM } from '../permissions/perms';
import { renderSecurityView, axiosError, clickAndFlush, flush, selectOption, READ, rowWith } from '../securityTestUtils';
import { formatUtcDateTime } from '../securityRules';

jest.mock('../securityApi');

const ANA = { id: 7, username: 'ana', is_active: true, is_superuser: false, created_at: '2026-10-01T12:00:00', updated_at: '2026-10-01T12:00:00' };
const ME = { ...ANA, id: 1, username: 'operador' };

const ACCESS_ANA = {
    user_id: 7,
    username: 'ana',
    is_active: true,
    is_superuser: false,
    roles: [],
    permissions: [
        {
            code: 'orders:read',
            resource: 'orders',
            action: 'read',
            description: 'Ver pedidos',
            sources: [
                { type: 'group', group: { id: 3, name: 'Operadores' }, role: { id: 2, name: 'Operador' } },
                { type: 'direct', role: { id: 5, name: 'Auditor' } },
            ],
        },
    ],
};

// Mi acceso: rbac:manage solo vía grupo "Seguridad" (4) → rol "Admin seguridad" (9).
const MY_ACCESS = {
    user_id: 1,
    username: 'operador',
    is_active: true,
    is_superuser: false,
    roles: [{ role: { id: 9, name: 'Admin seguridad' }, sources: [{ type: 'group', group: { id: 4, name: 'Seguridad' } }] }],
    permissions: [
        { code: PERM.RBAC_MANAGE, description: 'Administrar seguridad', sources: [{ type: 'group', group: { id: 4, name: 'Seguridad' }, role: { id: 9, name: 'Admin seguridad' } }] },
    ],
};

const DIRECT = [
    {
        id: 12,
        role: { id: 5, name: 'Auditor' },
        reason: 'Cubre auditoría de caja de noviembre',
        assigned_by: { id: 1, username: 'operador' },
        assigned_at: '2026-11-10T14:03:00',
    },
    { id: 13, role: { id: 6, name: 'Legado' }, reason: 'Migración', assigned_by: null, assigned_at: '2026-01-01T00:00:00' },
];

const IMPACT = { affected_users_count: 1, users_losing_permissions_count: 1, affected_users: [{ id: 7, username: 'ana', lost_permissions: ['orders:read'] }], removes_own_rbac_manage: false };

const setup = ({ user = ANA } = {}) => {
    securityApi.getUser.mockImplementation((id) => Promise.resolve(Number(id) === 1 ? ME : user));
    securityApi.listUserGroups.mockImplementation((id) =>
        Promise.resolve(Number(id) === 1 ? [{ id: 4, name: 'Seguridad', description: '' }] : [{ id: 3, name: 'Operadores', description: 'Operadores del taller' }])
    );
    securityApi.listUserDirectRoles.mockImplementation((id) => Promise.resolve(Number(id) === 1 ? [] : DIRECT));
    securityApi.getUserAccess.mockImplementation((id) => Promise.resolve(Number(id) === 1 ? MY_ACCESS : ACCESS_ANA));
    securityApi.listGroups.mockResolvedValue([
        { id: 3, name: 'Operadores' },
        { id: 4, name: 'Seguridad' },
        { id: 8, name: 'Ventas' },
    ]);
    securityApi.listRoles.mockResolvedValue([
        { id: 2, name: 'Operador' },
        { id: 5, name: 'Auditor' },
        { id: 6, name: 'Legado' },
    ]);
};

const renderDetail = (userId = 7, options = {}) => renderSecurityView(<UserDetailView />, { route: '/seguridad/usuarios/:userId', path: `/seguridad/usuarios/${userId}`, ...options });

const openTab = (name) => clickAndFlush(screen.getByRole('tab', { name }));

describe('UserDetailView (/seguridad/usuarios/:userId)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setup();
    });

    test('muestra el usuario y sus grupos; tiene las tres pestañas', async () => {
        await renderDetail();
        expect(screen.getByRole('heading', { name: 'ana' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Operadores' })).toHaveAttribute('href', '/seguridad/grupos/3');
        ['Grupos', 'Roles directos', 'Acceso efectivo'].forEach((name) => expect(screen.getByRole('tab', { name })).toBeInTheDocument());
    });

    test('roles directos: motivo, quién y cuándo (UTC → hora local); seed = "Sistema"', async () => {
        await renderDetail();
        await openTab('Roles directos');
        const row = rowWith('Cubre auditoría de caja de noviembre');
        expect(within(row).getByText('Auditor')).toBeInTheDocument();
        expect(within(row).getByText('operador')).toBeInTheDocument();
        expect(within(row).getByText(formatUtcDateTime('2026-11-10T14:03:00'))).toBeInTheDocument();
        expect(within(rowWith('Migración')).getByText(/Sistema/)).toBeInTheDocument();
    });

    test('acceso efectivo: cada permiso con su origen (vía grupo / directo)', async () => {
        await renderDetail();
        await openTab('Acceso efectivo');
        expect(screen.getByText('Ver pedidos')).toBeInTheDocument();
        const sources = screen.getByTestId('sources-orders:read');
        expect(within(sources).getByText('vía grupo Operadores → rol Operador')).toBeInTheDocument();
        expect(within(sources).getByText('directo → rol Auditor')).toBeInTheDocument();
        expect(screen.queryByText('orders:read')).not.toBeInTheDocument();
    });

    test('acceso efectivo de un superusuario lo indica y muestra "superusuario" como origen', async () => {
        securityApi.getUserAccess.mockImplementation((id) =>
            Promise.resolve(
                Number(id) === 1
                    ? MY_ACCESS
                    : { ...ACCESS_ANA, is_superuser: true, permissions: [{ code: 'orders:delete', description: 'Eliminar pedidos', sources: [{ type: 'superuser' }] }] }
            )
        );
        await renderDetail();
        await openTab('Acceso efectivo');
        expect(screen.getByText(/Es superusuario/)).toBeInTheDocument();
        expect(within(screen.getByTestId('sources-orders:delete')).getByText('superusuario')).toBeInTheDocument();
    });

    test('solo rbac:read: no hay acciones de escritura', async () => {
        await renderDetail(7, { permissions: READ });
        expect(screen.queryByRole('button', { name: /Agregar al grupo|Quitar/ })).not.toBeInTheDocument();
        await openTab('Roles directos');
        expect(screen.queryByRole('button', { name: /Asignar rol|Quitar/ })).not.toBeInTheDocument();
        expect(securityApi.listGroups).not.toHaveBeenCalled();
    });

    test('agregar a un grupo: solo ofrece los grupos donde no está; tras el cambio refresca permisos y recarga', async () => {
        securityApi.addUserToGroup.mockResolvedValue({ user_id: 7, group_id: 8 });
        const { refresh } = await renderDetail();
        const options = within(screen.getByLabelText('Grupo a agregar'))
            .getAllByRole('option')
            .map((o) => o.textContent);
        expect(options).toEqual(['Elegí un grupo…', 'Seguridad', 'Ventas']);
        expect(screen.getByRole('button', { name: /Agregar al grupo/ })).toBeDisabled();
        selectOption('Grupo a agregar', 8);
        await clickAndFlush(screen.getByRole('button', { name: /Agregar al grupo/ }));
        expect(securityApi.addUserToGroup).toHaveBeenCalledWith(7, 8);
        expect(refresh).toHaveBeenCalled();
        expect(securityApi.listUserGroups).toHaveBeenCalledTimes(2);
    });

    test('quitar de un grupo pide confirmación con el impacto (los dos números)', async () => {
        securityApi.getGroupMemberRemovalImpact.mockResolvedValue(IMPACT);
        securityApi.removeUserFromGroup.mockResolvedValue(undefined);
        const { refresh } = await renderDetail();
        await clickAndFlush(screen.getByRole('button', { name: 'Quitar del grupo Operadores' }));
        expect(securityApi.getGroupMemberRemovalImpact).toHaveBeenCalledWith(3, 7);
        expect(screen.getByTestId('impact-affected-count')).toHaveTextContent('1');
        expect(screen.getByTestId('impact-losing-count')).toHaveTextContent('1');
        await clickAndFlush(screen.getByRole('button', { name: 'Quitar del grupo' }));
        expect(securityApi.removeUserFromGroup).toHaveBeenCalledWith(7, 3);
        expect(refresh).toHaveBeenCalled();
    });

    test('asignar rol directo: el motivo es obligatorio', async () => {
        securityApi.assignDirectRole.mockResolvedValue(DIRECT[0]);
        await renderDetail();
        await openTab('Roles directos');
        const assign = screen.getByRole('button', { name: /Asignar rol/ });
        // Ofrece solo los roles que no tiene directo.
        expect(within(screen.getByLabelText('Rol a asignar')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Elegí un rol…', 'Operador']);
        selectOption('Rol a asignar', 2);
        expect(assign).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: '   ' } });
        expect(assign).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: '  Cubre vacaciones  ' } });
        expect(assign).toBeEnabled();
        await clickAndFlush(assign);
        expect(securityApi.assignDirectRole).toHaveBeenCalledWith(7, 2, 'Cubre vacaciones');
    });

    test('motivo de más de 255 caracteres no se puede enviar', async () => {
        await renderDetail();
        await openTab('Roles directos');
        selectOption('Rol a asignar', 2);
        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'x'.repeat(256) } });
        expect(screen.getByRole('button', { name: /Asignar rol/ })).toBeDisabled();
        expect(screen.getByText('256/255')).toBeInTheDocument();
    });

    test('422 del backend en el motivo se muestra junto al campo', async () => {
        securityApi.assignDirectRole.mockRejectedValue(axiosError(422, { error: 'Datos inválidos', code: 'VALIDATION_ERROR', errors: { reason: 'El motivo es obligatorio' } }));
        await renderDetail();
        await openTab('Roles directos');
        selectOption('Rol a asignar', 2);
        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'algo' } });
        await clickAndFlush(screen.getByRole('button', { name: /Asignar rol/ }));
        expect(screen.getAllByText(/El motivo es obligatorio/).length).toBeGreaterThan(0);
    });

    test('409 ALREADY_ASSIGNED → mensaje claro con el code', async () => {
        securityApi.assignDirectRole.mockRejectedValue(axiosError(409, { error: 'El rol ya está asignado al usuario', code: 'ALREADY_ASSIGNED' }));
        await renderDetail();
        await openTab('Roles directos');
        selectOption('Rol a asignar', 2);
        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'algo' } });
        await clickAndFlush(screen.getByRole('button', { name: /Asignar rol/ }));
        expect(screen.getByText('El rol ya está asignado al usuario (ALREADY_ASSIGNED)')).toBeInTheDocument();
    });

    test('quitar rol directo usa el impacto de la asignación directa', async () => {
        securityApi.getDirectRoleRemovalImpact.mockResolvedValue(IMPACT);
        securityApi.removeDirectRole.mockResolvedValue(undefined);
        await renderDetail();
        await openTab('Roles directos');
        await clickAndFlush(screen.getByRole('button', { name: 'Quitar rol Auditor' }));
        expect(securityApi.getDirectRoleRemovalImpact).toHaveBeenCalledWith(7, 5);
        await clickAndFlush(screen.getByRole('button', { name: 'Quitar rol' }));
        expect(securityApi.removeDirectRole).toHaveBeenCalledWith(7, 5);
    });

    describe('sobre mí mismo', () => {
        test('no puedo agregarme grupos ni roles directos (SELF_ASSIGNMENT), con explicación', async () => {
            await renderDetail(1, { userId: 1 });
            expect(screen.getByRole('button', { name: /Agregar al grupo/ })).toBeDisabled();
            expect(screen.getByTestId('blocked-reason')).toHaveTextContent(/SELF_ASSIGNMENT/);
            await openTab('Roles directos');
            expect(screen.getByRole('button', { name: /Asignar rol/ })).toBeDisabled();
            expect(screen.getByTestId('blocked-reason')).toHaveTextContent(/SELF_ASSIGNMENT/);
        });

        test('no puedo salir del único grupo que me da rbac:manage (SELF_LOCKOUT)', async () => {
            await renderDetail(1, { userId: 1 });
            expect(screen.getByRole('button', { name: 'Quitar del grupo Seguridad' })).toBeDisabled();
            expect(screen.getByTestId('lockout-reason')).toHaveTextContent(/SELF_LOCKOUT/);
        });

        test('el superusuario está exento', async () => {
            await renderDetail(1, { userId: 1, isSuperuser: true, permissions: [] });
            expect(screen.queryByTestId('blocked-reason')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Quitar del grupo Seguridad' })).toBeEnabled();
        });
    });

    test('404 → el usuario no existe', async () => {
        securityApi.getUser.mockRejectedValue(axiosError(404, { error: 'Usuario no encontrado', code: 'NOT_FOUND' }));
        await renderDetail(99);
        expect(screen.getByText('El usuario no existe.')).toBeInTheDocument();
    });

    test('403 → ForbiddenNotice', async () => {
        securityApi.getUser.mockRejectedValue(axiosError(403, { error: 'Acceso denegado: permisos insuficientes', code: 'FORBIDDEN' }));
        await renderDetail();
        await flush();
        expect(screen.getByTestId('forbidden-notice')).toBeInTheDocument();
    });
});
